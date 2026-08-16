import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { Errors } from "../lib/errors.js";
import { asyncHandler, requireAuth } from "../middleware/errorHandler.js";

export const authRouter = Router();

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: { user: req.user ?? null } });
  }),
);

authRouter.patch(
  "/me",
  requireAuth,
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
    req.user = { id: updated.id, name: updated.name, email: updated.email };
    res.json({ success: true, data: { user: req.user } });
  }),
);
