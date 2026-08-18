import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { Errors } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import { createDocumentFromUpload } from "../lib/create-document.js";
import { generateNotesFromText, generateQuizFromText } from "../lib/ai.js";
import { sendDocumentDownload } from "../lib/download.js";
import { fileUpload, mimeTypeFor } from "../lib/upload.js";
import { ownedDocument, ownedDocumentForDownload, ownedSpace, documentSummarySelect } from "../lib/study.js";
import { asyncHandler, auditFailures, requireAuth } from "../middleware/errorHandler.js";

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

documentsRouter.get(
  "/documents",
  asyncHandler(async (req, res) => {
    const documents = await prisma.document.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      select: {
        ...documentSummarySelect,
        space: { select: { id: true, title: true, courseCode: true } },
        _count: { select: { quizzes: true } },
        quizzes: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true },
        },
      },
    });
    res.json({
      success: true,
      data: documents.map((document) => ({
        id: document.id,
        title: document.title,
        filename: document.filename,
        summary: document.summary,
        createdAt: document.createdAt,
        quizCount: document._count.quizzes,
        latestQuizId: document.quizzes[0]?.id ?? null,
        spaceId: document.spaceId,
        space: document.space,
      })),
    });
  }),
);

documentsRouter.post(
  "/documents",
  auditFailures("document.create", "document", {
    metadata: (req) => ({
      filename: req.file?.originalname,
      byteLength: req.file?.size,
      spaceId: typeof req.body?.spaceId === "string" ? req.body.spaceId : undefined,
    }),
  }),
  fileUpload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw Errors.validation("Choose a file to upload.");

    const fields = z
      .object({
        title: z.string().trim().min(1).max(160).optional(),
        spaceId: z.string().trim().min(1).optional(),
      })
      .parse(req.body);

    const document = await createDocumentFromUpload({
      userId: req.user!.id,
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: mimeTypeFor(req.file.originalname, req.file.mimetype),
      title: fields.title ?? req.file.originalname,
      spaceId: fields.spaceId ?? null,
    });

    logAudit({
      req,
      action: "document.create",
      entityType: "document",
      entityId: document.id,
      metadata: { title: document.title, filename: document.filename, spaceId: document.spaceId },
    });

    res.status(201).json({
      success: true,
      data: { id: document.id, title: document.title, filename: document.filename },
    });
  }),
);

documentsRouter.get(
  "/documents/:id/download",
  asyncHandler(async (req, res) => {
    const document = await ownedDocumentForDownload(req.user!.id, req.params.id);
    sendDocumentDownload(res, document);
  }),
);

documentsRouter.get(
  "/documents/:id",
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      select: {
        ...documentSummarySelect,
        extractedText: true,
        space: { select: { id: true, title: true, courseCode: true } },
        quizzes: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            title: true,
            createdAt: true,
            _count: { select: { questions: true, attempts: true } },
          },
        },
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
        quizzes: document.quizzes.map((quiz) => ({
          id: quiz.id,
          title: quiz.title,
          questionCount: quiz._count.questions,
          attemptCount: quiz._count.attempts,
          createdAt: quiz.createdAt,
        })),
      },
    });
  }),
);

documentsRouter.patch(
  "/documents/:id",
  auditFailures("document.update", "document", {
    entityId: (req) => req.params.id,
    metadata: (req) => ({
      spaceId: typeof req.body?.spaceId === "string" ? req.body.spaceId : req.body?.spaceId,
    }),
  }),
  asyncHandler(async (req, res) => {
    const document = await ownedDocument(req.user!.id, req.params.id);
    const body = z.object({ spaceId: z.string().min(1).nullable() }).parse(req.body);
    if (body.spaceId) await ownedSpace(req.user!.id, body.spaceId);
    const updated = await prisma.document.update({ where: { id: document.id }, data: { spaceId: body.spaceId } });
    if (body.spaceId) {
      await prisma.space.update({ where: { id: body.spaceId }, data: { updatedAt: new Date() } });
    }
    logAudit({
      req,
      action: "document.update",
      entityType: "document",
      entityId: updated.id,
      metadata: { spaceId: updated.spaceId },
    });
    res.json({ success: true, data: { id: updated.id, spaceId: updated.spaceId } });
  }),
);

documentsRouter.post(
  "/documents/:id/notes",
  auditFailures("document.notes", "document", { entityId: (req) => req.params.id }),
  asyncHandler(async (req, res) => {
    const document = await ownedDocument(req.user!.id, req.params.id);
    const notes = await generateNotesFromText(document.title, document.extractedText);
    const updated = await prisma.document.update({
      where: { id: document.id },
      data: { summary: notes },
    });
    logAudit({
      req,
      action: "document.notes",
      entityType: "document",
      entityId: updated.id,
      metadata: { title: updated.title, noteLength: notes.length },
    });
    res.json({ success: true, data: { id: updated.id, summary: updated.summary } });
  }),
);

documentsRouter.delete(
  "/documents/:id",
  auditFailures("document.delete", "document", { entityId: (req) => req.params.id }),
  asyncHandler(async (req, res) => {
    const document = await ownedDocument(req.user!.id, req.params.id);
    await prisma.document.delete({ where: { id: document.id } });
    if (document.spaceId) {
      await prisma.space.update({ where: { id: document.spaceId }, data: { updatedAt: new Date() } });
    }
    logAudit({
      req,
      action: "document.delete",
      entityType: "document",
      entityId: document.id,
      metadata: { title: document.title, filename: document.filename },
    });
    res.json({ success: true, data: { id: document.id } });
  }),
);

documentsRouter.post(
  "/documents/:id/generate",
  auditFailures("quiz.generate", "quiz", {
    entityId: (req) => req.params.id,
    metadata: (req) => ({ documentId: req.params.id, questionCount: req.body?.count }),
  }),
  asyncHandler(async (req, res) => {
    const count = z.coerce.number().int().min(4).max(50).default(50).parse(req.body?.count ?? 50);
    const document = await ownedDocument(req.user!.id, req.params.id);
    const generated = await generateQuizFromText(document.title, document.extractedText, count);
    const quiz = await prisma.$transaction(async (tx) => {
      if (!document.summary.trim()) {
        await tx.document.update({ where: { id: document.id }, data: { summary: generated.summary } });
      }
      return tx.quiz.create({
        data: {
          documentId: document.id,
          userId: req.user!.id,
          title: `Quiz · ${document.title}`,
          questions: {
            create: generated.questions.map((question, index) => ({
              prompt: question.question,
              options: JSON.stringify(question.options),
              correctIndex: question.correctIndex,
              explanation: question.explanation,
              sortOrder: index,
            })),
          },
        },
        include: { questions: true },
      });
    });
    logAudit({
      req,
      action: "quiz.generate",
      entityType: "quiz",
      entityId: quiz.id,
      metadata: { documentId: document.id, questionCount: quiz.questions.length },
    });
    res.status(201).json({
      success: true,
      data: { quizId: quiz.id, summary: generated.summary, questionCount: quiz.questions.length },
    });
  }),
);
