import path from "node:path";
import { gunzipSync } from "node:zlib";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { Errors } from "../lib/errors.js";
import { logAudit, writeAudit } from "../lib/audit.js";
import { extractText } from "../lib/extract.js";
import { generateQuizFromText } from "../lib/ai.js";
import { ownedDocument, ownedSpace } from "../lib/study.js";
import { asyncHandler, auditFailures, requireAuth } from "../middleware/errorHandler.js";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_DECOMPRESSED_BYTES = 25 * 1024 * 1024;

const allowedTypes = new Map([
  [".pdf", "application/pdf"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".txt", "text/plain"],
  [".md", "text/markdown"],
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 6 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const expectedType = allowedTypes.get(extension);
    // Gzipped uploads keep the original filename but may arrive as octet-stream.
    if (expectedType && (expectedType === file.mimetype || file.mimetype === "application/octet-stream")) {
      cb(null, true);
      return;
    }
    cb(Errors.validation("Upload a valid PDF, Word (.docx), or text file."));
  },
});

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

documentsRouter.get(
  "/documents",
  asyncHandler(async (req, res) => {
    const documents = await prisma.document.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { quizzes: true } },
        space: { select: { id: true, title: true, courseCode: true } },
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
      contentLength: req.headers["content-length"],
    }),
  }),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw Errors.validation("Choose a file to upload.");
    const metadata = z
      .object({
        title: z.string().trim().min(1).max(160).optional(),
        spaceId: z.string().trim().min(1).optional(),
        compressed: z.enum(["gzip"]).optional(),
        displayFilename: z.string().trim().min(1).max(260).optional(),
      })
      .parse(req.body);
    if (metadata.spaceId) await ownedSpace(req.user!.id, metadata.spaceId);

    let buffer = req.file.buffer;
    if (metadata.compressed === "gzip") {
      try {
        buffer = gunzipSync(buffer);
      } catch {
        throw Errors.validation("Could not decompress that upload. Try uploading again.");
      }
      if (buffer.length > MAX_DECOMPRESSED_BYTES) {
        throw Errors.validation("That file is too large after decompression.");
      }
    }

    const displayName = metadata.displayFilename ?? req.file.originalname;
    const mimeType =
      allowedTypes.get(path.extname(req.file.originalname).toLowerCase()) ??
      (req.file.mimetype !== "application/octet-stream" ? req.file.mimetype : "text/plain");

    let text: string;
    try {
      text = await extractText(buffer, mimeType, req.file.originalname);
    } catch (error) {
      throw Errors.validation(error instanceof Error ? error.message : "Could not read that file.");
    }
    if (text.length < 80) throw Errors.validation("That file does not contain enough readable text to study from.");

    const document = await prisma.document.create({
      data: {
        userId: req.user!.id,
        spaceId: metadata.spaceId ?? null,
        title: metadata.title ?? displayName,
        filename: displayName,
        mimeType,
        extractedText: text,
      },
    });
    if (metadata.spaceId) {
      await prisma.space.update({ where: { id: metadata.spaceId }, data: { updatedAt: new Date() } });
    }
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

documentsRouter.post(
  "/documents/text",
  auditFailures("document.create", "document", {
    metadata: (req) => ({
      filename: typeof req.body?.filename === "string" ? req.body.filename : undefined,
      spaceId: typeof req.body?.spaceId === "string" ? req.body.spaceId : undefined,
      textBytes: typeof req.body?.text === "string" ? Buffer.byteLength(req.body.text, "utf8") : undefined,
    }),
  }),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        text: z.string().trim().min(80).max(3 * 1024 * 1024),
        filename: z.string().trim().min(1).max(260),
        title: z.string().trim().min(1).max(160).optional(),
        spaceId: z.string().trim().min(1).optional(),
      })
      .parse(req.body);
    const extension = path.extname(body.filename).toLowerCase();
    const mimeType = allowedTypes.get(extension);
    if (!mimeType) throw Errors.validation("Upload a valid PDF, Word (.docx), or text file.");
    if (body.spaceId) await ownedSpace(req.user!.id, body.spaceId);

    const document = await prisma.document.create({
      data: {
        userId: req.user!.id,
        spaceId: body.spaceId ?? null,
        title: body.title ?? body.filename,
        filename: body.filename,
        mimeType,
        extractedText: body.text,
      },
    });
    if (body.spaceId) {
      await prisma.space.update({ where: { id: body.spaceId }, data: { updatedAt: new Date() } });
    }
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

documentsRouter.post(
  "/documents/failures",
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        filename: z.string().trim().min(1).max(260),
        fileSize: z.number().int().nonnegative(),
        errorMessage: z.string().trim().min(1).max(300),
      })
      .parse(req.body);
    await writeAudit({
      req,
      action: "document.create_failed",
      entityType: "document",
      metadata: {
        filename: body.filename,
        byteLength: body.fileSize,
        errorCode: "CLIENT_PREPARATION",
        errorMessage: body.errorMessage,
        statusCode: 0,
      },
    });
    res.status(201).json({ success: true, data: { recorded: true } });
  }),
);

documentsRouter.get(
  "/documents/:id",
  asyncHandler(async (req, res) => {
    const document = await prisma.document.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: {
        quizzes: {
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { questions: true, attempts: true } } },
        },
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
      await tx.document.update({ where: { id: document.id }, data: { summary: generated.summary } });
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
