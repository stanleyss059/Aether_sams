import path from "node:path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const PPT_MIME = "application/vnd.ms-powerpoint";

export async function extractText(buffer: Buffer, mimeType: string, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  if (mimeType === "application/pdf" || ext === ".pdf") {
    const result = await pdfParse(buffer);
    return clean(result.text);
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return clean(result.value);
  }
  if (isPowerPoint(mimeType, ext)) {
    const { extractPowerPoint } = await import("./extract-powerpoint.js");
    return extractPowerPoint(buffer, ext);
  }
  if (mimeType.startsWith("text/") || [".txt", ".md"].includes(ext)) {
    return clean(buffer.toString("utf8"));
  }
  throw new Error("Unsupported file type. Upload a PDF, Word, PowerPoint, or text file.");
}

function isPowerPoint(mimeType: string, ext: string) {
  return ext === ".ppt" || ext === ".pptx" || mimeType === PPT_MIME || mimeType === PPTX_MIME;
}

function clean(text: string) {
  return text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
