import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { AppError, Errors } from "../lib/errors.js";
import { ensureLocalUser, type AppUser, supabaseAuth } from "../lib/supabase.js";

declare global {
  namespace Express {
    interface Request {
      user?: AppUser;
    }
  }
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void fn(req, res, next).catch(next);
  };
}

export const attachSupabaseUser = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const token = header.slice("Bearer ".length).trim();
    if (token) {
      try {
        const { data, error } = await supabaseAuth.auth.getUser(token);
        if (!error && data.user) {
          req.user = await ensureLocalUser(data.user);
        }
      } catch (error) {
        console.error("attachSupabaseUser failed:", error);
        throw error;
      }
    }
  }
  next();
});

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(Errors.unauthorized());
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

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: { message: err.message, code: err.code } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: { message: err.issues[0]?.message ?? "Invalid request.", code: "VALIDATION" },
    });
    return;
  }
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File is still over 4MB after compression. Try a shorter export or a .txt file."
        : "Invalid upload.";
    res.status(400).json({ success: false, error: { message, code: "VALIDATION" } });
    return;
  }
  console.error(err);
  res.status(500).json({
    success: false,
    error: {
      message:
        process.env.NODE_ENV === "production"
          ? "Something went wrong. Please try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
      code: "INTERNAL",
    },
  });
}
