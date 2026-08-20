import { generateNotesFromText } from "./ai.js";
import { prisma } from "./prisma.js";

let notesTail = Promise.resolve();

export function queueDocumentNotes(document: { id: string; title: string; extractedText: string }) {
  notesTail = notesTail
    .catch(() => undefined)
    .then(() =>
      generateNotesFromText(document.title, document.extractedText).then(async (notes) => {
        await prisma.document.update({ where: { id: document.id }, data: { summary: notes } });
      }),
    )
    .catch((error) => {
      console.error("Background note generation failed:", error);
    });
}
