import JSZip from "jszip";
import pptToText from "ppt-to-text";

export async function extractPowerPoint(buffer: Buffer, ext: string) {
  const asZip = looksLikeZip(buffer);
  const asOle = looksLikeOle(buffer);
  try {
    if (ext === ".pptx" || (asZip && !asOle)) {
      return await extractPptx(buffer);
    }
    return extractPpt(buffer);
  } catch (error) {
    if (asZip && ext === ".ppt") return extractPptx(buffer);
    if (asOle && ext === ".pptx") return extractPpt(buffer);
    throw error;
  }
}

function extractPpt(buffer: Buffer) {
  try {
    const text = pptToText.extractText(buffer);
    const cleaned = clean(typeof text === "string" ? text : "");
    if (!cleaned) throw new Error("empty");
    return cleaned;
  } catch {
    throw new Error("Could not read that PowerPoint file.");
  }
}

async function extractPptx(buffer: Buffer) {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error("Could not read that PowerPoint file.");
  }

  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => slideNumber(a) - slideNumber(b));
  if (!slides.length) {
    throw new Error("Could not read that PowerPoint file.");
  }

  const parts: string[] = [];
  for (const name of slides) {
    const file = zip.file(name);
    if (!file) continue;
    const slideText = textFromOfficeXml(await file.async("string"));
    const notesFile = zip.file(`ppt/notesSlides/notesSlide${slideNumber(name)}.xml`);
    const notesText = notesFile ? textFromOfficeXml(await notesFile.async("string")) : "";
    const combined = [slideText, notesText].filter(Boolean).join("\n");
    if (combined) parts.push(combined);
  }

  const cleaned = clean(parts.join("\n\n"));
  if (!cleaned) {
    throw new Error("That PowerPoint file does not contain enough readable text.");
  }
  return cleaned;
}

function slideNumber(name: string) {
  const match = /slide(\d+)\.xml$/i.exec(name);
  return match ? Number(match[1]) : 0;
}

function textFromOfficeXml(xml: string) {
  const chunks: string[] = [];
  const pattern = /<a:t\b[^>]*>([^<]*)<\/a:t>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) {
    const piece = decodeXmlEntities(match[1]).replace(/\s+/g, " ").trim();
    if (piece) chunks.push(piece);
  }
  return chunks.join(" ");
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => fromCodePoint(Number.parseInt(dec, 10)));
}

function fromCodePoint(code: number) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  return String.fromCodePoint(code);
}

function looksLikeZip(buffer: Buffer) {
  return buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function looksLikeOle(buffer: Buffer) {
  return buffer.length >= 4 && buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0;
}

function clean(text: string) {
  return text.replace(/\u0000/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
