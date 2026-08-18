import { Router } from "express";
import { Errors } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import { ownedSpace, serializeSpace, spaceInput, documentSummarySelect } from "../lib/study.js";
import { asyncHandler, auditFailures, requireAuth } from "../middleware/errorHandler.js";

export const spacesRouter = Router();
spacesRouter.use((req, res, next) => {
  const path = `${req.originalUrl ?? ""} ${req.url ?? ""} ${req.path ?? ""}`.toLowerCase();
  if (!path.includes("/spaces")) {
    next();
    return;
  }
  requireAuth(req, res, next);
});

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
        select: {
          ...documentSummarySelect,
          _count: { select: { quizzes: true } },
        },
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
  auditFailures("space.create", "space", {
    metadata: (req) => ({
      title: typeof req.body?.title === "string" ? req.body.title : undefined,
      courseCode: typeof req.body?.courseCode === "string" ? req.body.courseCode : undefined,
    }),
  }),
  asyncHandler(async (req, res) => {
    const space = await prisma.space.create({
      data: { ...spaceInput.parse(req.body), userId: req.user!.id },
      include: { documents: { select: documentSummarySelect } },
    });
    logAudit({
      req,
      action: "space.create",
      entityType: "space",
      entityId: space.id,
      metadata: { title: space.title, courseCode: space.courseCode },
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
        documents: {
          orderBy: { createdAt: "desc" },
          select: {
            ...documentSummarySelect,
            _count: { select: { quizzes: true } },
            quizzes: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
          },
        },
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
          latestQuizId: document.quizzes[0]?.id ?? null,
          createdAt: document.createdAt,
        })),
      }),
    });
  }),
);

spacesRouter.patch(
  "/spaces/:id",
  auditFailures("space.update", "space", {
    entityId: (req) => req.params.id,
    metadata: (req) => ({ title: typeof req.body?.title === "string" ? req.body.title : undefined }),
  }),
  asyncHandler(async (req, res) => {
    await ownedSpace(req.user!.id, req.params.id);
    const space = await prisma.space.update({
      where: { id: req.params.id },
      data: spaceInput.partial().parse(req.body),
      include: { documents: { select: { id: true, _count: { select: { quizzes: true } } } } },
    });
    logAudit({
      req,
      action: "space.update",
      entityType: "space",
      entityId: space.id,
      metadata: { title: space.title },
    });
    res.json({ success: true, data: serializeSpace(space) });
  }),
);

spacesRouter.delete(
  "/spaces/:id",
  auditFailures("space.delete", "space", { entityId: (req) => req.params.id }),
  asyncHandler(async (req, res) => {
    await ownedSpace(req.user!.id, req.params.id);
    await prisma.space.delete({ where: { id: req.params.id } });
    logAudit({
      req,
      action: "space.delete",
      entityType: "space",
      entityId: req.params.id,
    });
    res.json({ success: true, data: { id: req.params.id } });
  }),
);
