import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

type PdfParse = (buf: Buffer) => Promise<{ text: string }>;

function vendorRoots() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return [path.join(here, "vercel-vendor"), path.join(process.cwd(), "src", "vercel-vendor")];
}

function loadPdfParse(): PdfParse {
  // Use lib/pdf-parse.js so the package debug harness does not crash the process.
  const files = ["lib/pdf-parse.js", "index.js"];
  if (process.env.VERCEL) {
    for (const root of vendorRoots()) {
      for (const file of files) {
        try {
          return require(path.join(root, "pdf-parse", file)) as PdfParse;
        } catch {
          // Try the next layout Vercel may use for bundled functions.
        }
      }
    }
  }
  try {
    return require("pdf-parse/lib/pdf-parse.js") as PdfParse;
  } catch {
    return require("pdf-parse") as PdfParse;
  }
}

type Mammoth = {
  extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
};

async function loadMammoth(): Promise<Mammoth> {
  if (process.env.VERCEL) {
    for (const root of vendorRoots()) {
      try {
        return require(path.join(root, "mammoth")) as Mammoth;
      } catch {
        // Try the next layout Vercel may use for bundled functions.
      }
    }
    throw new Error("Word parser is unavailable on this deployment.");
  }
  const mod = await import("mammoth");
  return mod.default;
}

export async function extractText(buffer: Buffer, mimeType: string, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();
  if (mimeType === "application/pdf" || ext === ".pdf") {
    const result = await loadPdfParse()(buffer);
    return clean(result.text);
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    const mammoth = await loadMammoth();
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
