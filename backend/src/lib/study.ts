import { z } from "zod";
import { prisma } from "./prisma.js";
import { Errors } from "./errors.js";

export const spaceInput = z.object({
  title: z.string().trim().min(1).max(80),
  courseCode: z.string().trim().max(32).optional().default(""),
  description: z.string().trim().max(280).optional().default(""),
  accent: z.enum(["forest", "gold", "clay", "slate"]).optional().default("forest"),
});

export async function ownedSpace(userId: string, id: string) {
  const space = await prisma.space.findFirst({ where: { id, userId } });
  if (!space) throw Errors.notFound("Space not found.");
  return space;
}

/** List/detail views — never load multi-MB file bytes or full extracted text. */
export const documentSummarySelect = {
  id: true,
  userId: true,
  spaceId: true,
  title: true,
  filename: true,
  mimeType: true,
  summary: true,
  fileUrl: true,
  createdAt: true,
} as const;

/** Includes extracted text for quiz/notes generation — not file bytes. */
export const documentWithTextSelect = {
  ...documentSummarySelect,
  extractedText: true,
  storagePath: true,
} as const;

export async function ownedDocument(userId: string, id: string) {
  const document = await prisma.document.findFirst({
    where: { id, userId },
    select: documentWithTextSelect,
  });
  if (!document) throw Errors.notFound("Document not found.");
  return document;
}

export async function ownedDocumentForDownload(userId: string, id: string) {
  const document = await prisma.document.findFirst({
    where: { id, userId },
    select: {
      filename: true,
      mimeType: true,
      extractedText: true,
      storagePath: true,
      fileUrl: true,
      fileData: true,
    },
  });
  if (!document) throw Errors.notFound("Document not found.");
  return document;
}

export async function ownedQuiz(userId: string, id: string) {
  const quiz = await prisma.quiz.findFirst({ where: { id, userId } });
  if (!quiz) throw Errors.notFound("Quiz not found.");
  return quiz;
}

export function serializeSpace(
  space: {
    id: string;
    title: string;
    courseCode: string;
    description: string;
    accent: string;
    createdAt: Date;
    documents: Array<{ id: string; _count?: { quizzes: number }; quizzes?: unknown[] }>;
  },
  extra: Record<string, unknown> = {},
) {
  return {
    id: space.id,
    title: space.title,
    courseCode: space.courseCode,
    description: space.description,
    accent: space.accent,
    createdAt: space.createdAt,
    documentCount: space.documents.length,
    quizCount: space.documents.reduce(
      (sum, doc) => sum + (doc._count?.quizzes ?? (Array.isArray(doc.quizzes) ? doc.quizzes.length : 0)),
      0,
    ),
    ...extra,
  };
}
