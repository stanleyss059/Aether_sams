import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { Errors } from "../lib/errors.js";
import { asyncHandler, requireAuth } from "../middleware/errorHandler.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(2).max(80),
        email: z.string().trim().email(),
        password: z.string().min(8).max(128),
      })
      .parse(req.body);
    const email = body.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) throw Errors.conflict("An account with this email already exists.");
    const user = await prisma.user.create({
      data: { name: body.name, email, passwordHash: await hashPassword(body.password) },
    });
    req.session.user = { id: user.id, name: user.name, email: user.email };
    res.status(201).json({ success: true, data: { user: req.session.user } });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: z.string().trim().email(),
        password: z.string().min(1),
      })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
      throw Errors.unauthorized("Invalid email or password.");
    }
    req.session.user = { id: user.id, name: user.name, email: user.email };
    res.json({ success: true, data: { user: req.session.user } });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    req.session.destroy(() => undefined);
    res.clearCookie("sf.user", { path: "/" });
    res.clearCookie("sf.sid", { path: "/" });
    res.json({ success: true, data: { ok: true } });
  }),
);

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: { user: req.session.user ?? null } });
  }),
);

authRouter.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().trim().min(2).max(80).optional(),
        currentPassword: z.string().min(1).optional(),
        newPassword: z.string().min(8).max(128).optional(),
      })
      .refine((value) => value.name || value.newPassword, { message: "Nothing to update." })
      .refine((value) => !value.newPassword || Boolean(value.currentPassword), {
        message: "Enter your current password to set a new one.",
      })
      .parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.session.user!.id } });
    if (!user) throw Errors.notFound("Account not found.");

    const data: { name?: string; passwordHash?: string } = {};
    if (body.name) data.name = body.name;
    if (body.newPassword) {
      if (!(await verifyPassword(user.passwordHash, body.currentPassword ?? ""))) {
        throw Errors.unauthorized("Current password is incorrect.");
      }
      data.passwordHash = await hashPassword(body.newPassword);
    }

    const updated = await prisma.user.update({ where: { id: user.id }, data });
    req.session.user = { id: updated.id, name: updated.name, email: updated.email };
    res.json({ success: true, data: { user: req.session.user } });
  }),
);
