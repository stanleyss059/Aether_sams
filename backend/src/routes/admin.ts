import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { Errors } from "../lib/errors.js";
import { writeAudit } from "../lib/audit.js";
import { sendDocumentDownload } from "../lib/download.js";
import { asyncHandler, auditFailures, requireAuth, requireAdmin } from "../middleware/errorHandler.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional().default(""),
});

function pagination(page: number, pageSize: number, total: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

adminRouter.get(
  "/dashboard",
  asyncHandler(async (_req, res) => {
    const [userCount, spaceCount, documentCount, quizCount, attemptCount, suspendedCount, recent] =
      await Promise.all([
        prisma.user.count(),
        prisma.space.count(),
        prisma.document.count(),
        prisma.quiz.count(),
        prisma.attempt.count(),
        prisma.user.count({ where: { suspendedAt: { not: null } } }),
        prisma.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 12,
        }),
      ]);

    res.json({
      success: true,
      data: {
        stats: {
          users: userCount,
          spaces: spaceCount,
          documents: documentCount,
          quizzes: quizCount,
          attempts: attemptCount,
          suspended: suspendedCount,
        },
        recentActivity: recent.map(serializeAudit),
      },
    });
  }),
);

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const { page, pageSize, q } = pageSchema.parse(req.query);
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          _count: { select: { spaces: true, documents: true, quizzes: true, attempts: true } },
        },
      }),
    ]);
    res.json({
      success: true,
      data: {
        items: users.map((user) => ({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          suspendedAt: user.suspendedAt,
          createdAt: user.createdAt,
          spaceCount: user._count.spaces,
          documentCount: user._count.documents,
          quizCount: user._count.quizzes,
          attemptCount: user._count.attempts,
        })),
        ...pagination(page, pageSize, total),
      },
    });
  }),
);

adminRouter.post(
  "/users/:id/suspend",
  auditFailures("admin.user.suspend", "user", { entityId: (req) => req.params.id }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw Errors.notFound("User not found.");
    if (user.id === req.user!.id) throw Errors.validation("You cannot suspend your own account.");
    if (user.role === "ADMIN") throw Errors.forbidden("Admin accounts cannot be suspended.");

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { suspendedAt: new Date() },
    });
    await writeAudit({
      req,
      action: "admin.user.suspend",
      entityType: "user",
      entityId: updated.id,
      metadata: { email: updated.email, name: updated.name },
    });
    res.json({
      success: true,
      data: {
        id: updated.id,
        suspendedAt: updated.suspendedAt,
      },
    });
  }),
);

adminRouter.post(
  "/users/:id/reactivate",
  auditFailures("admin.user.reactivate", "user", { entityId: (req) => req.params.id }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw Errors.notFound("User not found.");

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { suspendedAt: null },
    });
    await writeAudit({
      req,
      action: "admin.user.reactivate",
      entityType: "user",
      entityId: updated.id,
      metadata: { email: updated.email, name: updated.name },
    });
    res.json({
      success: true,
      data: {
        id: updated.id,
        suspendedAt: null,
      },
    });
  }),
);

adminRouter.delete(
  "/users/:id",
  auditFailures("admin.user.delete", "user", { entityId: (req) => req.params.id }),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw Errors.notFound("User not found.");
    if (user.id === req.user!.id) throw Errors.validation("You cannot delete your own account.");
    if (user.role === "ADMIN") throw Errors.forbidden("Admin accounts cannot be deleted here.");

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          actorEmail: req.user!.email,
          actorName: req.user!.name,
          action: "admin.user.delete",
          entityType: "user",
          entityId: user.id,
          metadata: JSON.stringify({ email: user.email, name: user.name }),
          ip: typeof req.headers["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"].split(",")[0]?.trim() : req.ip || null,
          userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        },
      });
      await tx.user.delete({ where: { id: user.id } });
    });

    res.json({ success: true, data: { id: user.id } });
  }),
);

adminRouter.get(
  "/documents",
  asyncHandler(async (req, res) => {
    const { page, pageSize, q } = pageSchema.parse(req.query);
    const where = q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { filename: { contains: q, mode: "insensitive" as const } },
            { user: { email: { contains: q, mode: "insensitive" as const } } },
            { user: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {};
    const [total, documents] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          title: true,
          filename: true,
          createdAt: true,
          user: { select: { id: true, name: true, email: true } },
          space: { select: { id: true, title: true, courseCode: true } },
          _count: { select: { quizzes: true } },
        },
      }),
    ]);
    res.json({
      success: true,
      data: {
        items: documents.map((document) => ({
          id: document.id,
          title: document.title,
          filename: document.filename,
          createdAt: document.createdAt,
          quizCount: document._count.quizzes,
          owner: document.user,
          space: document.space,
        })),
        ...pagination(page, pageSize, total),
      },
    });
  }),
);

adminRouter.get(
  "/documents/:id/download",
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!document) throw Errors.notFound("Document not found.");
    sendDocumentDownload(res, document);
  }),
);

adminRouter.delete(
  "/documents/:id",
  auditFailures("admin.document.delete", "document", { entityId: (req) => req.params.id }),
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { email: true } } },
    });
    if (!document) throw Errors.notFound("Document not found.");

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          actorEmail: req.user!.email,
          actorName: req.user!.name,
          action: "admin.document.delete",
          entityType: "document",
          entityId: document.id,
          metadata: JSON.stringify({
            title: document.title,
            filename: document.filename,
            ownerEmail: document.user.email,
          }),
          ip: typeof req.headers["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"].split(",")[0]?.trim() : req.ip || null,
          userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        },
      });
      await tx.document.delete({ where: { id: document.id } });
    });

    res.json({ success: true, data: { id: document.id } });
  }),
);

adminRouter.get(
  "/spaces",
  asyncHandler(async (req, res) => {
    const { page, pageSize, q } = pageSchema.parse(req.query);
    const where = q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" as const } },
            { courseCode: { contains: q, mode: "insensitive" as const } },
            { user: { email: { contains: q, mode: "insensitive" as const } } },
            { user: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {};
    const [total, spaces] = await Promise.all([
      prisma.space.count({ where }),
      prisma.space.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: { select: { id: true, name: true, email: true } },
          documents: { select: { id: true, _count: { select: { quizzes: true } } } },
        },
      }),
    ]);
    res.json({
      success: true,
      data: {
        items: spaces.map((space) => ({
          id: space.id,
          title: space.title,
          courseCode: space.courseCode,
          description: space.description,
          accent: space.accent,
          createdAt: space.createdAt,
          updatedAt: space.updatedAt,
          documentCount: space.documents.length,
          quizCount: space.documents.reduce((sum, doc) => sum + doc._count.quizzes, 0),
          owner: space.user,
        })),
        ...pagination(page, pageSize, total),
      },
    });
  }),
);

adminRouter.delete(
  "/spaces/:id",
  auditFailures("admin.space.delete", "space", { entityId: (req) => req.params.id }),
  asyncHandler(async (req, res) => {
    const space = await prisma.space.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { email: true } } },
    });
    if (!space) throw Errors.notFound("Space not found.");

    await prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          actorUserId: req.user!.id,
          actorEmail: req.user!.email,
          actorName: req.user!.name,
          action: "admin.space.delete",
          entityType: "space",
          entityId: space.id,
          metadata: JSON.stringify({
            title: space.title,
            courseCode: space.courseCode,
            ownerEmail: space.user.email,
          }),
          ip: typeof req.headers["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"].split(",")[0]?.trim() : req.ip || null,
          userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        },
      });
      // Documents stay owned by the user but become unfiled when the space is removed.
      await tx.document.updateMany({ where: { spaceId: space.id }, data: { spaceId: null } });
      await tx.space.delete({ where: { id: space.id } });
    });

    res.json({ success: true, data: { id: space.id } });
  }),
);

adminRouter.get(
  "/audit-logs",
  asyncHandler(async (req, res) => {
    const query = pageSchema
      .extend({
        action: z.string().trim().optional().default(""),
        entityType: z.string().trim().optional().default(""),
      })
      .parse(req.query);

    const filters = [];
    if (query.q) {
      filters.push({
        OR: [
          { actorEmail: { contains: query.q, mode: "insensitive" as const } },
          { actorName: { contains: query.q, mode: "insensitive" as const } },
          { action: { contains: query.q, mode: "insensitive" as const } },
          { entityId: { contains: query.q, mode: "insensitive" as const } },
        ],
      });
    }
    if (query.action) filters.push({ action: { contains: query.action, mode: "insensitive" as const } });
    if (query.entityType) filters.push({ entityType: query.entityType });

    const where = filters.length ? { AND: filters } : {};
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    res.json({
      success: true,
      data: {
        items: logs.map(serializeAudit),
        ...pagination(query.page, query.pageSize, total),
      },
    });
  }),
);

function serializeAudit(log: {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}) {
  let metadata: Record<string, unknown> = {};
  try {
    metadata = JSON.parse(log.metadata) as Record<string, unknown>;
  } catch {
    metadata = {};
  }
  return {
    id: log.id,
    actorUserId: log.actorUserId,
    actorEmail: log.actorEmail,
    actorName: log.actorName,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    metadata,
    ip: log.ip,
    userAgent: log.userAgent,
    createdAt: log.createdAt,
  };
}
