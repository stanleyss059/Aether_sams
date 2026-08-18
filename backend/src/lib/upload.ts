import path from "node:path";
import multer from "multer";
import { Errors } from "./errors.js";

export const MAX_UPLOAD_BYTES = 3.5 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES = new Map([
  [".pdf", "application/pdf"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".txt", "text/plain"],
  [".md", "text/markdown"],
]);

export const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 8 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const expected = ALLOWED_UPLOAD_TYPES.get(extension);
    if (expected && (file.mimetype === expected || file.mimetype === "application/octet-stream")) {
      cb(null, true);
      return;
    }
    cb(Errors.validation("Upload a PDF, Word (.docx), or text file."));
  },
});

export function mimeTypeFor(filename: string, reported: string) {
  const extension = path.extname(filename).toLowerCase();
  return ALLOWED_UPLOAD_TYPES.get(extension) ?? (reported !== "application/octet-stream" ? reported : "text/plain");
}
