import path from "node:path";
import mammoth from "mammoth";
// pdf-parse's package root runs a self-test against a sample PDF. Import the
// implementation file so serverless deploys do not look for that fixture.
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export async function extractText(buffer: Buffer, mimeType: string, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  if (mimeType === "application/pdf" || ext === ".pdf") {
    const result = await (pdfParse as (buf: Buffer) => Promise<{ text: string }>)(buffer);
    return clean(result.text);
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return clean(result.value);
  }
  if (mimeType.startsWith("text/") || [".txt", ".md"].includes(ext)) {
    return clean(buffer.toString("utf8"));
  }
  throw new Error("Unsupported file type. Upload a PDF, Word (.docx), or text file.");
}

function clean(text: string) {
  return text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
