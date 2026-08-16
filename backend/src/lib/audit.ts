import type { Request } from "express";
import { prisma } from "./prisma.js";
import type { AppUser } from "./supabase.js";

export type AuditInput = {
  actor?: AppUser | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  req?: Request;
};

function clientIp(req?: Request) {
  if (!req) return null;
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0]?.trim() ?? null;
  return req.ip || null;
}

/** Fire-and-forget audit writer — never throws to callers. */
export function logAudit(input: AuditInput) {
  void writeAudit(input).catch((error) => {
    console.error("Failed to write audit log:", error);
  });
}

export async function writeAudit(input: AuditInput) {
  const actor = input.actor ?? input.req?.user ?? null;
  await prisma.auditLog.create({
    data: {
      actorUserId: actor?.id ?? null,
      actorEmail: actor?.email ?? null,
      actorName: actor?.name ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: JSON.stringify(input.metadata ?? {}),
      ip: clientIp(input.req),
      userAgent: typeof input.req?.headers["user-agent"] === "string" ? input.req.headers["user-agent"] : null,
    },
  });
}
