const MAX_TEXT_BYTES = 3 * 1024 * 1024;

// Vite emits a real hashed asset URL for this worker in production.
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export type PreparedUpload = {
  text: string;
  filename: string;
};

function guessMime(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

function cleanText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return cleanText(pages.join("\n\n"));
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return cleanText(result.value);
}

async function extractUploadText(file: File): Promise<string> {
  const mime = file.type || guessMime(file.name);
  const lower = file.name.toLowerCase();
  let text: string;
  if (mime.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".md")) {
    text = cleanText(await file.text());
  } else if (mime === "application/pdf" || lower.endsWith(".pdf")) {
    text = await extractPdfText(file);
  } else if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lower.endsWith(".docx")
  ) {
    text = await extractDocxText(file);
  } else {
    throw new Error("Unsupported file type. Upload a PDF, Word (.docx), or text file.");
  }
  if (text.length < 80) {
    throw new Error("That file does not contain enough readable text to study from.");
  }
  return text;
}

/** Extract in the browser so serverless APIs receive reliable JSON instead of multipart files. */
export async function prepareUpload(file: File): Promise<PreparedUpload> {
  const text = await extractUploadText(file);
  if (new TextEncoder().encode(text).byteLength > MAX_TEXT_BYTES) {
    throw new Error(
      `“${file.name}” contains over 3MB of text. Try a shorter export or split it into multiple files.`,
    );
  }
  return { text, filename: file.name };
}
