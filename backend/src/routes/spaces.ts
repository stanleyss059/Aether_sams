import { Router } from "express";
import { Errors } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import { ownedSpace, serializeSpace, spaceInput } from "../lib/study.js";
import { asyncHandler, requireAuth } from "../middleware/errorHandler.js";

export const spacesRouter = Router();
spacesRouter.use(requireAuth);

spacesRouter.get(
  "/spaces",
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const [spaces, unfiled] = await Promise.all([
      prisma.space.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        include: { documents: { select: { id: true, _count: { select: { quizzes: true } } } } },
      }),
      prisma.document.findMany({
        where: { userId, spaceId: null },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { quizzes: true } } },
      }),
    ]);
    res.json({
      success: true,
      data: {
        spaces: spaces.map((space) => serializeSpace(space)),
        unfiled: unfiled.map((document) => ({
          id: document.id,
          title: document.title,
          filename: document.filename,
          summary: document.summary,
          quizCount: document._count.quizzes,
          createdAt: document.createdAt,
        })),
      },
    });
  }),
);

spacesRouter.post(
  "/spaces",
  asyncHandler(async (req, res) => {
    const space = await prisma.space.create({
      data: { ...spaceInput.parse(req.body), userId: req.user!.id },
      include: { documents: true },
    });
    res.status(201).json({ success: true, data: serializeSpace(space) });
  }),
);

spacesRouter.get(
  "/spaces/:id",
  asyncHandler(async (req, res) => {
    const space = await prisma.space.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: {
        documents: { orderBy: { createdAt: "desc" }, include: { _count: { select: { quizzes: true } } } },
      },
    });
    if (!space) throw Errors.notFound("Space not found.");
    res.json({
      success: true,
      data: serializeSpace(space, {
        documents: space.documents.map((document) => ({
          id: document.id,
          title: document.title,
          filename: document.filename,
          summary: document.summary,
          quizCount: document._count.quizzes,
          createdAt: document.createdAt,
        })),
      }),
    });
  }),
);

spacesRouter.patch(
  "/spaces/:id",
  asyncHandler(async (req, res) => {
    await ownedSpace(req.user!.id, req.params.id);
    const space = await prisma.space.update({
      where: { id: req.params.id },
      data: spaceInput.partial().parse(req.body),
      include: { documents: { select: { id: true, _count: { select: { quizzes: true } } } } },
    });
    res.json({ success: true, data: serializeSpace(space) });
  }),
);

spacesRouter.delete(
  "/spaces/:id",
  asyncHandler(async (req, res) => {
    await ownedSpace(req.user!.id, req.params.id);
    await prisma.space.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { id: req.params.id } });
  }),
);
