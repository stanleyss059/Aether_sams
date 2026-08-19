import path from "node:path";
import multer from "multer";
import { Errors } from "./errors.js";

export const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;

export const UNSUPPORTED_UPLOAD_MESSAGE = "Upload a PDF, Word, PowerPoint, or text file.";

export const ALLOWED_UPLOAD_TYPES = new Map([
  [".pdf", "application/pdf"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".ppt", "application/vnd.ms-powerpoint"],
  [".pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  [".txt", "text/plain"],
  [".md", "text/markdown"],
]);

export function isAllowedUploadFilename(filename: string) {
  return ALLOWED_UPLOAD_TYPES.has(path.extname(filename).toLowerCase());
}

export function assertAllowedUploadFilename(filename: string) {
  if (!isAllowedUploadFilename(filename)) {
    throw Errors.validation(UNSUPPORTED_UPLOAD_MESSAGE);
  }
}

export const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 8 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_UPLOAD_TYPES.has(extension)) {
      cb(null, true);
      return;
    }
    cb(Errors.validation(UNSUPPORTED_UPLOAD_MESSAGE));
  },
});

export function mimeTypeFor(filename: string, reported: string) {
  const extension = path.extname(filename).toLowerCase();
  return ALLOWED_UPLOAD_TYPES.get(extension) ?? (reported !== "application/octet-stream" ? reported : "text/plain");
}
