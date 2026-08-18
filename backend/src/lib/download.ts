import type { Response } from "express";
import path from "node:path";
import { downloadStoredFile } from "./storage.js";

export function textDownloadFilename(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === ".txt" || extension === ".md") return filename;
  const base = path.basename(filename, extension) || "download";
  return `${base}.txt`;
}

export function attachmentFilename(filename: string) {
  const safe = filename.replace(/[^\w.\- ()[\]]+/g, "_");
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

type DownloadDocument = {
  filename: string;
  mimeType: string;
  extractedText: string;
  storagePath?: string | null;
  fileData: Uint8Array | null;
};

export async function sendDocumentDownload(
  res: Response,
  document: DownloadDocument,
  accessToken?: string,
) {
  if (document.storagePath) {
    const file = await downloadStoredFile(document.storagePath, accessToken);
    res.setHeader("Content-Type", document.mimeType);
    res.setHeader("Content-Disposition", attachmentFilename(document.filename));
    res.send(file);
    return;
  }

  if (document.fileData && document.fileData.length > 0) {
    res.setHeader("Content-Type", document.mimeType);
    res.setHeader("Content-Disposition", attachmentFilename(document.filename));
    res.send(Buffer.from(document.fileData));
    return;
  }

  const filename = textDownloadFilename(document.filename);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", attachmentFilename(filename));
  res.send(document.extractedText);
}
