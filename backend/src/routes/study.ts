import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";
import { Errors } from "../lib/errors.js";
import { extractText } from "../lib/extract.js";
import { generateQuizFromText } from "../lib/ai.js";
import { asyncHandler, requireAuth } from "../middleware/errorHandler.js";

export const studyRouter = Router();
studyRouter.use(requireAuth);

const dest = path.resolve(config.uploadDir);
fs.mkdirSync(dest, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/markdown",
    ].includes(file.mimetype) || /\.(pdf|docx|txt|md)$/i.test(file.originalname);
    cb(ok ? null : Errors.validation("Upload a PDF, Word (.docx), or text file."), ok);
  },
});

const spaceBody = z.object({
  title: z.string().trim().min(1).max(80),
  courseCode: z.string().trim().max(32).optional().default(""),
  description: z.string().trim().max(280).optional().default(""),
  accent: z.enum(["forest", "gold", "clay", "slate"]).optional().default("forest"),
});

function serializeSpace(
  space: {
    id: string;
    title: string;
    courseCode: string;
    description: string;
    accent: string;
    createdAt: Date;
    documents: Array<{ id: string; _count?: { quizzes: number }; quizzes?: unknown[] }>;
  },
  extra: Record<string, unknown> = {},
) {
  const documentCount = space.documents.length;
  const quizCount = space.documents.reduce((sum, doc) => {
    if (typeof doc._count?.quizzes === "number") return sum + doc._count.quizzes;
    if (Array.isArray(doc.quizzes)) return sum + doc.quizzes.length;
    return sum;
  }, 0);
  return {
    id: space.id,
    title: space.title,
    courseCode: space.courseCode,
    description: space.description,
    accent: space.accent,
    createdAt: space.createdAt,
    documentCount,
    quizCount,
    ...extra,
  };
}

async function ownedSpace(userId: string, spaceId: string) {
  const space = await prisma.space.findFirst({ where: { id: spaceId, userId } });
  if (!space) throw Errors.notFound("Space not found.");
  return space;
}

studyRouter.get(
  "/spaces",
  asyncHandler(async (req, res) => {
    const userId = req.session.user!.id;
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
        unfiled: unfiled.map((d) => ({
          id: d.id,
          title: d.title,
          filename: d.filename,
          quizCount: d._count.quizzes,
          createdAt: d.createdAt,
        })),
      },
    });
  }),
);

studyRouter.post(
  "/spaces",
  asyncHandler(async (req, res) => {
    const body = spaceBody.parse(req.body);
    const space = await prisma.space.create({
      data: { ...body, userId: req.session.user!.id },
      include: { documents: true },
    });
    res.status(201).json({ success: true, data: serializeSpace(space) });
  }),
);

studyRouter.get(
  "/spaces/:id",
  asyncHandler(async (req, res) => {
    const space = await prisma.space.findFirst({
      where: { id: req.params.id, userId: req.session.user!.id },
      include: {
        documents: {
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { quizzes: true } } },
        },
      },
    });
    if (!space) throw Errors.notFound("Space not found.");
    res.json({
      success: true,
      data: serializeSpace(space, {
        documents: space.documents.map((d) => ({
          id: d.id,
          title: d.title,
          filename: d.filename,
          summary: d.summary,
          quizCount: d._count.quizzes,
          createdAt: d.createdAt,
        })),
      }),
    });
  }),
);

studyRouter.patch(
  "/spaces/:id",
  asyncHandler(async (req, res) => {
    await ownedSpace(req.session.user!.id, req.params.id);
    const body = spaceBody.partial().parse(req.body);
    const space = await prisma.space.update({
      where: { id: req.params.id },
      data: body,
      include: { documents: { select: { id: true, _count: { select: { quizzes: true } } } } },
    });
    res.json({ success: true, data: serializeSpace(space) });
  }),
);

studyRouter.delete(
  "/spaces/:id",
  asyncHandler(async (req, res) => {
    await ownedSpace(req.session.user!.id, req.params.id);
    await prisma.space.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { id: req.params.id } });
  }),
);

studyRouter.get(
  "/documents",
  asyncHandler(async (req, res) => {
    const documents = await prisma.document.findMany({
      where: { userId: req.session.user!.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { quizzes: true } },
        space: { select: { id: true, title: true, courseCode: true } },
      },
    });
    res.json({
      success: true,
      data: documents.map((d) => ({
        id: d.id,
        title: d.title,
        filename: d.filename,
        summary: d.summary,
        createdAt: d.createdAt,
        quizCount: d._count.quizzes,
        spaceId: d.spaceId,
        space: d.space,
      })),
    });
  }),
);

studyRouter.post(
  "/documents",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw Errors.validation("Choose a file to upload.");
    const title = (typeof req.body?.title === "string" && req.body.title.trim()) || req.file.originalname;
    const spaceId = typeof req.body?.spaceId === "string" && req.body.spaceId.trim() ? req.body.spaceId.trim() : null;
    if (spaceId) await ownedSpace(req.session.user!.id, spaceId);
    let text = "";
    try {
      text = await extractText(req.file.path, req.file.mimetype, req.file.originalname);
    } catch (error) {
      fs.unlink(req.file.path, () => undefined);
      throw Errors.validation(error instanceof Error ? error.message : "Could not read that file.");
    }
    if (text.length < 80) {
      throw Errors.validation("That file does not contain enough readable text to study from.");
    }
    const document = await prisma.document.create({
      data: {
        userId: req.session.user!.id,
        spaceId,
        title,
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        extractedText: text,
      },
    });
    if (spaceId) {
      await prisma.space.update({ where: { id: spaceId }, data: { updatedAt: new Date() } });
    }
    res.status(201).json({
      success: true,
      data: { id: document.id, title: document.title, filename: document.filename },
    });
  }),
);

studyRouter.get(
  "/documents/:id",
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.session.user!.id },
      include: {
        quizzes: { orderBy: { createdAt: "desc" }, include: { _count: { select: { questions: true, attempts: true } } } },
        space: { select: { id: true, title: true, courseCode: true } },
      },
    });
    if (!document) throw Errors.notFound("Document not found.");
    res.json({
      success: true,
      data: {
        id: document.id,
        title: document.title,
        filename: document.filename,
        summary: document.summary,
        excerpt: document.extractedText.slice(0, 1200),
        createdAt: document.createdAt,
        space: document.space,
        quizzes: document.quizzes.map((q) => ({
          id: q.id,
          title: q.title,
          questionCount: q._count.questions,
          attemptCount: q._count.attempts,
          createdAt: q.createdAt,
        })),
      },
    });
  }),
);

studyRouter.patch(
  "/documents/:id",
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.session.user!.id },
    });
    if (!document) throw Errors.notFound("Document not found.");
    const body = z
      .object({
        spaceId: z.string().min(1).nullable(),
      })
      .parse(req.body);
    if (body.spaceId) await ownedSpace(req.session.user!.id, body.spaceId);
    const updated = await prisma.document.update({
      where: { id: document.id },
      data: { spaceId: body.spaceId },
    });
    if (body.spaceId) {
      await prisma.space.update({ where: { id: body.spaceId }, data: { updatedAt: new Date() } });
    }
    res.json({ success: true, data: { id: updated.id, spaceId: updated.spaceId } });
  }),
);

studyRouter.post(
  "/documents/:id/generate",
  asyncHandler(async (req, res) => {
    const count = z.number().int().min(4).max(50).optional().default(50).parse(Number(req.body?.count ?? 50));
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.session.user!.id },
    });
    if (!document) throw Errors.notFound("Document not found.");
    const generated = await generateQuizFromText(document.title, document.extractedText, count);
    const quiz = await prisma.$transaction(async (tx) => {
      await tx.document.update({ where: { id: document.id }, data: { summary: generated.summary } });
      return tx.quiz.create({
        data: {
          documentId: document.id,
          userId: req.session.user!.id,
          title: `Quiz · ${document.title}`,
          questions: {
            create: generated.questions.map((q, index) => ({
              prompt: q.question,
              options: JSON.stringify(q.options),
              correctIndex: q.correctIndex,
              explanation: q.explanation,
              sortOrder: index,
            })),
          },
        },
        include: { questions: true },
      });
    });
    res.status(201).json({
      success: true,
      data: { quizId: quiz.id, summary: generated.summary, questionCount: quiz.questions.length },
    });
  }),
);

studyRouter.get(
  "/quizzes/:id",
  asyncHandler(async (req, res) => {
    const quiz = await prisma.quiz.findFirst({
      where: { id: req.params.id, userId: req.session.user!.id },
      include: { questions: { orderBy: { sortOrder: "asc" } }, document: { select: { title: true } } },
    });
    if (!quiz) throw Errors.notFound("Quiz not found.");
    res.json({
      success: true,
      data: {
        id: quiz.id,
        title: quiz.title,
        documentId: quiz.documentId,
        documentTitle: quiz.document.title,
        questions: quiz.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          options: JSON.parse(q.options) as string[],
        })),
      },
    });
  }),
);

studyRouter.post(
  "/quizzes/:id/attempt",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        answers: z.record(z.string(), z.number().int().min(0).max(3)),
      })
      .parse(req.body);
    const quiz = await prisma.quiz.findFirst({
      where: { id: req.params.id, userId: req.session.user!.id },
      include: { questions: true },
    });
    if (!quiz) throw Errors.notFound("Quiz not found.");
    let score = 0;
    const review = quiz.questions.map((q) => {
      const selected = body.answers[q.id];
      const correct = selected === q.correctIndex;
      if (correct) score += 1;
      return {
        id: q.id,
        prompt: q.prompt,
        options: JSON.parse(q.options) as string[],
        selectedIndex: selected ?? null,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        correct,
      };
    });
    const attempt = await prisma.attempt.create({
      data: {
        quizId: quiz.id,
        userId: req.session.user!.id,
        answers: JSON.stringify(body.answers),
        score,
        total: quiz.questions.length,
      },
    });
    res.status(201).json({
      success: true,
      data: { attemptId: attempt.id, score, total: quiz.questions.length, review },
    });
  }),
);
