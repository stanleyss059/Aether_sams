import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { Errors } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import { asyncHandler, auditFailures, requireAuth } from "../middleware/errorHandler.js";

export const authRouter = Router();

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: { user: req.user ?? null } });
  }),
);

authRouter.post(
  "/events",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        event: z.enum(["login", "logout"]),
      })
      .parse(req.body);

    logAudit({
      req,
      actor: req.user,
      action: body.event === "login" ? "auth.login" : "auth.logout",
      entityType: "user",
      entityId: req.user!.id,
      metadata: { email: req.user!.email },
    });

    res.json({ success: true, data: { ok: true } });
  }),
);

authRouter.patch(
  "/me",
  requireAuth,
  auditFailures("profile.update", "user", {
    entityId: (req) => req.user?.id,
  }),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(2).max(80),
      })
      .parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw Errors.notFound("Account not found.");

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name: body.name },
    });
    req.user = {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      suspendedAt: updated.suspendedAt ? updated.suspendedAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
    };
    logAudit({
      req,
      actor: req.user,
      action: "profile.update",
      entityType: "user",
      entityId: updated.id,
      metadata: { name: updated.name },
    });
    res.json({ success: true, data: { user: req.user } });
  }),
);
