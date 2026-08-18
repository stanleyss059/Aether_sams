import { prisma } from "./prisma.js";
import { Errors } from "./errors.js";
import { extractText } from "./extract.js";
import { queueDocumentNotes } from "./notes.js";
import { ownedSpace } from "./study.js";

type CreateDocumentInput = {
  userId: string;
  buffer: Buffer;
  filename: string;
  mimeType: string;
  title: string;
  spaceId?: string | null;
};

export async function createDocumentFromUpload(input: CreateDocumentInput) {
  if (input.spaceId) await ownedSpace(input.userId, input.spaceId);

  let text: string;
  try {
    text = await extractText(input.buffer, input.mimeType, input.filename);
  } catch (error) {
    throw Errors.validation(error instanceof Error ? error.message : "Could not read that file.");
  }
  if (text.length < 80) {
    throw Errors.validation("That file does not contain enough readable text to study from.");
  }

  const document = await prisma.document.create({
    data: {
      userId: input.userId,
      spaceId: input.spaceId ?? null,
      title: input.title,
      filename: input.filename,
      mimeType: input.mimeType,
      extractedText: text,
      fileData: Uint8Array.from(input.buffer),
    },
  });

  if (input.spaceId) {
    await prisma.space.update({ where: { id: input.spaceId }, data: { updatedAt: new Date() } });
  }

  if (process.env.VERCEL) void queueDocumentNotes(document);
  else await queueDocumentNotes(document);

  return document;
}
