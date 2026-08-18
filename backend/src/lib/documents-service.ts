import { z } from "zod";
import { prisma } from "./prisma.js";
import { Errors } from "./errors.js";
import { extractText } from "./extract.js";
import { generateNotesFromText, generateQuizFromText } from "./ai.js";
import { queueDocumentNotes } from "./notes.js";
import { mimeTypeFor } from "./upload.js";
import { newDocumentId, removeStoredFile, uploadUserFile } from "./storage.js";
import {
  documentSummarySelect,
  ownedDocument,
  ownedDocumentForDownload,
  ownedSpace,
} from "./study.js";

const uploadFieldsSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  spaceId: z.string().trim().min(1).optional(),
});

const moveSchema = z.object({
  spaceId: z.string().min(1).nullable(),
});

const quizCountSchema = z.coerce.number().int().min(4).max(50).default(50);

function serializeListItem(document: {
  id: string;
  title: string;
  filename: string;
  summary: string;
  fileUrl: string;
  createdAt: Date;
  spaceId: string | null;
  space: { id: string; title: string; courseCode: string } | null;
  _count: { quizzes: number };
  quizzes: { id: string }[];
}) {
  return {
    id: document.id,
    title: document.title,
    filename: document.filename,
    summary: document.summary,
    fileUrl: document.fileUrl || null,
    createdAt: document.createdAt,
    quizCount: document._count.quizzes,
    latestQuizId: document.quizzes[0]?.id ?? null,
    spaceId: document.spaceId,
    space: document.space,
  };
}

export async function listUserDocuments(userId: string) {
  const documents = await prisma.document.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      ...documentSummarySelect,
      space: { select: { id: true, title: true, courseCode: true } },
      _count: { select: { quizzes: true } },
      quizzes: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
    },
  });
  return documents.map(serializeListItem);
}

export async function getUserDocument(userId: string, id: string) {
  const document = await prisma.document.findFirst({
    where: { id, userId },
    select: {
      ...documentSummarySelect,
      extractedText: true,
      space: { select: { id: true, title: true, courseCode: true } },
      quizzes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          createdAt: true,
          _count: { select: { questions: true, attempts: true } },
        },
      },
    },
  });
  if (!document) throw Errors.notFound("Document not found.");

  return {
    id: document.id,
    title: document.title,
    filename: document.filename,
    summary: document.summary,
    excerpt: document.extractedText.slice(0, 1200),
    fileUrl: document.fileUrl || null,
    createdAt: document.createdAt,
    space: document.space,
    quizzes: document.quizzes.map((quiz) => ({
      id: quiz.id,
      title: quiz.title,
      questionCount: quiz._count.questions,
      attemptCount: quiz._count.attempts,
      createdAt: quiz.createdAt,
    })),
  };
}

export async function createUserDocument(
  userId: string,
  file: Express.Multer.File,
  rawFields: unknown,
  accessToken?: string,
) {
  const fields = uploadFieldsSchema.parse(rawFields);
  if (fields.spaceId) await ownedSpace(userId, fields.spaceId);

  const mimeType = mimeTypeFor(file.originalname, file.mimetype);
  let text: string;
  try {
    text = await extractText(file.buffer, mimeType, file.originalname);
  } catch (error) {
    throw Errors.validation(error instanceof Error ? error.message : "Could not read that file.");
  }
  if (text.length < 80) {
    throw Errors.validation("That file does not contain enough readable text to study from.");
  }

  const id = newDocumentId();
  const stored = await uploadUserFile({
    userId,
    documentId: id,
    filename: file.originalname,
    mimeType,
    buffer: file.buffer,
    accessToken,
  });

  const title = fields.title ?? file.originalname;
  try {
    const document = await prisma.document.create({
      data: {
        id,
        userId,
        spaceId: fields.spaceId ?? null,
        title,
        filename: file.originalname,
        mimeType,
        extractedText: text,
        storagePath: stored.storagePath,
        fileUrl: stored.fileUrl,
      },
    });

    if (fields.spaceId) {
      await prisma.space.update({ where: { id: fields.spaceId }, data: { updatedAt: new Date() } });
    }

    if (process.env.VERCEL) void queueDocumentNotes(document);
    else await queueDocumentNotes(document);

    return {
      id: document.id,
      title: document.title,
      filename: document.filename,
      fileUrl: document.fileUrl,
    };
  } catch (error) {
    await removeStoredFile(stored.storagePath, accessToken);
    throw error;
  }
}

export async function moveUserDocument(userId: string, id: string, rawBody: unknown) {
  const document = await ownedDocument(userId, id);
  const body = moveSchema.parse(rawBody);
  if (body.spaceId) await ownedSpace(userId, body.spaceId);

  const updated = await prisma.document.update({
    where: { id: document.id },
    data: { spaceId: body.spaceId },
  });

  if (body.spaceId) {
    await prisma.space.update({ where: { id: body.spaceId }, data: { updatedAt: new Date() } });
  }

  return { id: updated.id, spaceId: updated.spaceId };
}

export async function deleteUserDocument(userId: string, id: string, accessToken?: string) {
  const document = await ownedDocument(userId, id);
  await prisma.document.delete({ where: { id: document.id } });
  await removeStoredFile(document.storagePath, accessToken);
  if (document.spaceId) {
    await prisma.space.update({ where: { id: document.spaceId }, data: { updatedAt: new Date() } });
  }
  return {
    id: document.id,
    title: document.title,
    filename: document.filename,
    spaceId: document.spaceId,
  };
}

export async function generateUserDocumentNotes(userId: string, id: string) {
  const document = await ownedDocument(userId, id);
  const notes = await generateNotesFromText(document.title, document.extractedText);
  const updated = await prisma.document.update({
    where: { id: document.id },
    data: { summary: notes },
  });
  return { id: updated.id, summary: updated.summary, title: updated.title, noteLength: notes.length };
}

export async function generateUserDocumentQuiz(userId: string, id: string, rawBody: unknown) {
  const count = quizCountSchema.parse(
    typeof rawBody === "object" && rawBody && "count" in rawBody
      ? (rawBody as { count?: unknown }).count ?? 50
      : 50,
  );
  const document = await ownedDocument(userId, id);
  const generated = await generateQuizFromText(document.title, document.extractedText, count);

  const quiz = await prisma.$transaction(async (tx) => {
    if (!document.summary.trim()) {
      await tx.document.update({ where: { id: document.id }, data: { summary: generated.summary } });
    }
    return tx.quiz.create({
      data: {
        documentId: document.id,
        userId,
        title: `Quiz · ${document.title}`,
        questions: {
          create: generated.questions.map((question, index) => ({
            prompt: question.question,
            options: JSON.stringify(question.options),
            correctIndex: question.correctIndex,
            explanation: question.explanation,
            sortOrder: index,
          })),
        },
      },
      include: { questions: true },
    });
  });

  return {
    quizId: quiz.id,
    summary: generated.summary,
    questionCount: quiz.questions.length,
    documentId: document.id,
  };
}

export async function downloadUserDocument(userId: string, id: string) {
  return ownedDocumentForDownload(userId, id);
}
