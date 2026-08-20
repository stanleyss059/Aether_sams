import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { writeAudit } from "../lib/audit.js";
import { readAccessToken } from "../lib/auth-token.js";
import { AppError, Errors } from "../lib/errors.js";
import { ensureLocalUser, type AppUser, supabaseAuth } from "../lib/supabase.js";

type AuditIntent = {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: (req: Request) => Record<string, unknown>;
};

declare global {
  namespace Express {
    interface Request {
      user?: AppUser;
      auditIntent?: AuditIntent;
    }
  }
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

export const attachSupabaseUser = asyncHandler(async (req, _res, next) => {
  if (req.user) {
    next();
    return;
  }

  const token = readAccessToken(req);
  if (!token) {
    next();
    return;
  }

  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) {
    console.error("Supabase token rejected:", error?.message ?? "unknown error");
    next();
    return;
  }

  try {
    req.user = await ensureLocalUser(data.user);
  } catch (syncError) {
    console.error("Failed to sync Supabase user to database:", syncError);
    next(Errors.serviceUnavailable("Could not load your account. Try again in a moment.", "DATABASE"));
    return;
  }

  next();
});

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    const hadToken = Boolean(readAccessToken(req));
    next(
      hadToken
        ? new AppError(401, "Your session expired or could not be verified. Sign in again.", "UNAUTHORIZED")
        : Errors.unauthorized(),
    );
    return;
  }
  if (req.user.suspendedAt) {
    next(new AppError(403, "Your account has been suspended.", "SUSPENDED"));
    return;
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(Errors.unauthorized());
    return;
  }
  if (req.user.suspendedAt) {
    next(new AppError(403, "Your account has been suspended.", "SUSPENDED"));
    return;
  }
  if (req.user.role !== "ADMIN") {
    next(Errors.forbidden("Admin access required."));
    return;
  }
  next();
}

export function auditFailures(
  action: string,
  entityType: string,
  options: {
    entityId?: (req: Request) => string | null | undefined;
    metadata?: (req: Request) => Record<string, unknown>;
  } = {},
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.auditIntent = {
      action,
      entityType,
      entityId: options.entityId?.(req) ?? null,
      metadata: options.metadata,
    };
    next();
  };
}

function describeError(err: unknown) {
  if (err instanceof AppError) {
    return { status: err.statusCode, code: err.code, message: err.message };
  }
  if (err instanceof ZodError) {
    return { status: 400, code: "VALIDATION", message: err.issues[0]?.message ?? "Invalid request." };
  }
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File is still over 4MB after compression. Try a shorter export or a .txt file."
        : "Invalid upload.";
    return { status: 400, code: "VALIDATION", message };
  }
  const prismaCode = typeof err === "object" && err && "code" in err ? String((err as { code: unknown }).code) : "";
  if (prismaCode === "P2024") {
    return {
      status: 503,
      code: "DATABASE",
      message: "The server is busy. Try again in a moment.",
    };
  }
  return { status: 500, code: "INTERNAL", message: "Something went wrong. Please try again." };
}

export async function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const detail = describeError(err);
  if (req.user && req.auditIntent) {
    let attempted: Record<string, unknown> = {};
    try {
      attempted = req.auditIntent.metadata?.(req) ?? {};
    } catch {
      // Audit metadata must never mask the original request failure.
    }
    try {
      await writeAudit({
        req,
        action: `${req.auditIntent.action}_failed`,
        entityType: req.auditIntent.entityType,
        entityId: req.auditIntent.entityId,
        metadata: {
          ...attempted,
          errorCode: detail.code,
          errorMessage: detail.message,
          statusCode: detail.status,
        },
      });
    } catch (auditError) {
      console.error("Failed to write failure audit log:", auditError);
    }
  }
  if (detail.status < 500) {
    res.status(detail.status).json({ success: false, error: { message: detail.message, code: detail.code } });
    return;
  }
  console.error(err);
  res.status(500).json({
    success: false,
    error: { message: detail.message, code: detail.code },
  });
}
