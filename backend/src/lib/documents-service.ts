import { z } from "zod";
import { prisma } from "./prisma.js";
import { Errors } from "./errors.js";
import { generateNotesFromText, generateQuizFromText } from "./ai.js";
import { queueDocumentNotes } from "./notes.js";
import { assertAllowedUploadFilename, mimeTypeFor } from "./upload.js";
import { createSignedUpload, newDocumentId, removeStoredFile, storageObjectPath, downloadStoredFile } from "./storage.js";
import {
  documentSummarySelect,
  ownedDocument,
  ownedDocumentForDownload,
  ownedSpace,
} from "./study.js";

const uploadFieldsSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  spaceId: z.string().trim().min(1),
});

const completeUploadSchema = z.object({
  documentId: z.string().uuid(),
  spaceId: z.string().trim().min(1),
  filename: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(160).optional(),
  mimeType: z.string().trim().min(1).optional(),
  storagePath: z.string().trim().min(1),
  fileUrl: z.string().trim().min(1).optional(),
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

export async function prepareUserUpload(rawFields: unknown) {
  const fields = uploadFieldsSchema.extend({
    filename: z.string().trim().min(1).max(200),
  }).parse(rawFields);
  assertAllowedUploadFilename(fields.filename);
  const space = await prisma.space.findUnique({
    where: { id: fields.spaceId },
    select: { id: true, userId: true },
  });
  if (!space) throw Errors.notFound("Space not found.");

  const documentId = newDocumentId();
  const objectPath = storageObjectPath(space.userId, documentId, fields.filename);
  const signed = await createSignedUpload(objectPath);
  return {
    documentId,
    spaceId: space.id,
    filename: fields.filename,
    title: fields.title ?? fields.filename,
    ...signed,
  };
}

export async function completeUserUpload(rawFields: unknown) {
  const fields = completeUploadSchema.parse(rawFields);
  const space = await prisma.space.findUnique({
    where: { id: fields.spaceId },
    select: { id: true, userId: true },
  });
  if (!space) throw Errors.notFound("Space not found.");

  const expectedPrefix = `${space.userId}/${fields.documentId}/`;
  if (!fields.storagePath.startsWith(expectedPrefix)) {
    throw Errors.validation("That upload does not belong to this space.");
  }

  const buffer = await downloadStoredFile(fields.storagePath);
  assertAllowedUploadFilename(fields.filename);
  const mimeType = mimeTypeFor(fields.filename, fields.mimeType ?? "application/octet-stream");
  let text: string;
  try {
    const { extractText } = await import("./extract.js");
    text = await extractText(buffer, mimeType, fields.filename);
  } catch (error) {
    await removeStoredFile(fields.storagePath);
    throw Errors.validation(error instanceof Error ? error.message : "Could not read that file.");
  }
  if (text.length < 80) {
    await removeStoredFile(fields.storagePath);
    throw Errors.validation("That file does not contain enough readable text to study from.");
  }

  const title = fields.title ?? fields.filename;
  try {
    const document = await prisma.document.create({
      data: {
        id: fields.documentId,
        userId: space.userId,
        spaceId: space.id,
        title,
        filename: fields.filename,
        mimeType,
        extractedText: text,
        storagePath: fields.storagePath,
        fileUrl: fields.fileUrl ?? "",
      },
    });

    await prisma.space.update({ where: { id: space.id }, data: { updatedAt: new Date() } });

    if (process.env.VERCEL) void queueDocumentNotes(document);
    else await queueDocumentNotes(document);

    return {
      id: document.id,
      title: document.title,
      filename: document.filename,
      fileUrl: document.fileUrl,
    };
  } catch (error) {
    await removeStoredFile(fields.storagePath);
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
