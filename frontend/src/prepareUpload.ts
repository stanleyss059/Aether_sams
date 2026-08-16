const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export type PreparedUpload = {
  file: File;
  compressed: boolean;
  reducedToText: boolean;
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

async function gzipFile(file: File): Promise<Blob> {
  if (typeof CompressionStream === "undefined") {
    throw new Error("This browser cannot compress uploads. Try Chrome, Edge, or Firefox.");
  }
  const stream = file.stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).blob();
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
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
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

async function reduceToTextFile(file: File): Promise<File> {
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
  const base = file.name.replace(/\.[^.]+$/, "") || "notes";
  return new File([text], `${base}.txt`, { type: "text/plain" });
}

/** Compress files over 4MB. If still too large (common for PDF/DOCX), extract text and upload that instead. */
export async function prepareUpload(file: File): Promise<PreparedUpload> {
  if (file.size <= MAX_UPLOAD_BYTES) {
    return { file, compressed: false, reducedToText: false };
  }

  try {
    const gzipped = await gzipFile(file);
    if (gzipped.size <= MAX_UPLOAD_BYTES) {
      const compressed = new File([gzipped], file.name, {
        type: file.type || guessMime(file.name),
      });
      return { file: compressed, compressed: true, reducedToText: false };
    }
  } catch {
    // Fall through to text extraction.
  }

  const textFile = await reduceToTextFile(file);
  if (textFile.size > MAX_UPLOAD_BYTES) {
    const gzippedText = await gzipFile(textFile);
    if (gzippedText.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        `“${file.name}” is still over 4MB after compression. Try a shorter export or a .txt file.`,
      );
    }
    return {
      file: new File([gzippedText], textFile.name, { type: "text/plain" }),
      compressed: true,
      reducedToText: true,
    };
  }
  return { file: textFile, compressed: false, reducedToText: true };
}
