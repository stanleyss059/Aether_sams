import { Router } from "express";
import { logAudit } from "../lib/audit.js";
import { readAccessToken } from "../lib/auth-token.js";
import { sendDocumentDownload } from "../lib/download.js";
import {
  completeUserUpload,
  deleteUserDocument,
  downloadUserDocument,
  generateUserDocumentNotes,
  generateUserDocumentQuiz,
  getUserDocument,
  listUserDocuments,
  moveUserDocument,
  prepareUserUpload,
} from "../lib/documents-service.js";
import { asyncHandler, auditFailures, requireAuth } from "../middleware/errorHandler.js";

function requestPath(req: { method?: string; path?: string; url?: string; originalUrl?: string }) {
  return `${req.originalUrl ?? ""} ${req.url ?? ""} ${req.path ?? ""}`.toLowerCase();
}

function isPublicUpload(req: { method?: string; path?: string; url?: string; originalUrl?: string }) {
  if (req.method !== "POST") return false;
  const path = requestPath(req);
  return path.includes("/documents/prepare") || path.includes("/documents/complete");
}

export const documentsRouter = Router();
documentsRouter.use((req, res, next) => {
  if (isPublicUpload(req)) {
    next();
    return;
  }
  if (!requestPath(req).includes("/documents")) {
    next();
    return;
  }
  requireAuth(req, res, next);
});

documentsRouter.get(
  "/documents",
  asyncHandler(async (req, res) => {
    const data = await listUserDocuments(req.user!.id);
    res.json({ success: true, data });
  }),
);

documentsRouter.post(
  "/documents/prepare",
  asyncHandler(async (req, res) => {
    const data = await prepareUserUpload(req.body);
    res.json({ success: true, data });
  }),
);

documentsRouter.post(
  "/documents/complete",
  auditFailures("document.create", "document", {
    metadata: (req) => ({
      filename: typeof req.body?.filename === "string" ? req.body.filename : undefined,
      spaceId: typeof req.body?.spaceId === "string" ? req.body.spaceId : undefined,
    }),
  }),
  asyncHandler(async (req, res) => {
    const data = await completeUserUpload(req.body);
    logAudit({
      req,
      action: "document.create",
      entityType: "document",
      entityId: data.id,
      metadata: { title: data.title, filename: data.filename },
    });
    res.status(201).json({ success: true, data });
  }),
);

documentsRouter.get(
  "/documents/:id/download",
  asyncHandler(async (req, res) => {
    const document = await downloadUserDocument(req.user!.id, req.params.id);
    await sendDocumentDownload(res, document, readAccessToken(req));
  }),
);

documentsRouter.get(
  "/documents/:id",
  asyncHandler(async (req, res) => {
    const data = await getUserDocument(req.user!.id, req.params.id);
    res.json({ success: true, data });
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
    const data = await moveUserDocument(req.user!.id, req.params.id, req.body);
    logAudit({
      req,
      action: "document.update",
      entityType: "document",
      entityId: data.id,
      metadata: { spaceId: data.spaceId },
    });
    res.json({ success: true, data });
  }),
);

documentsRouter.post(
  "/documents/:id/notes",
  auditFailures("document.notes", "document", { entityId: (req) => req.params.id }),
  asyncHandler(async (req, res) => {
    const data = await generateUserDocumentNotes(req.user!.id, req.params.id);
    logAudit({
      req,
      action: "document.notes",
      entityType: "document",
      entityId: data.id,
      metadata: { title: data.title, noteLength: data.noteLength },
    });
    res.json({ success: true, data: { id: data.id, summary: data.summary } });
  }),
);

documentsRouter.delete(
  "/documents/:id",
  auditFailures("document.delete", "document", { entityId: (req) => req.params.id }),
  asyncHandler(async (req, res) => {
    const data = await deleteUserDocument(req.user!.id, req.params.id, readAccessToken(req));
    logAudit({
      req,
      action: "document.delete",
      entityType: "document",
      entityId: data.id,
      metadata: { title: data.title, filename: data.filename },
    });
    res.json({ success: true, data: { id: data.id } });
  }),
);

documentsRouter.post(
  "/documents/:id/generate",
  auditFailures("quiz.generate", "quiz", {
    entityId: (req) => req.params.id,
    metadata: (req) => ({ documentId: req.params.id, questionCount: req.body?.count }),
  }),
  asyncHandler(async (req, res) => {
    const data = await generateUserDocumentQuiz(req.user!.id, req.params.id, req.body);
    logAudit({
      req,
      action: "quiz.generate",
      entityType: "quiz",
      entityId: data.quizId,
      metadata: { documentId: data.documentId, questionCount: data.questionCount },
    });
    res.status(201).json({ success: true, data });
  }),
);
