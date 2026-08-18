import type { Response } from "express";
import path from "node:path";

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
  fileData: Uint8Array | null;
};

export function sendDocumentDownload(res: Response, document: DownloadDocument) {
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
