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
