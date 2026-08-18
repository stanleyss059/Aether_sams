import { generateNotesFromText } from "./ai.js";
import { prisma } from "./prisma.js";

export function queueDocumentNotes(document: { id: string; title: string; extractedText: string }) {
  const work = generateNotesFromText(document.title, document.extractedText)
    .then(async (notes) => {
      await prisma.document.update({ where: { id: document.id }, data: { summary: notes } });
    })
    .catch((error) => {
      console.error("Background note generation failed:", error);
    });

  if (!process.env.VERCEL) return work;

  return import("@vercel/functions")
    .then(({ waitUntil }) => {
      waitUntil(work);
    })
    .catch(() => work);
}
