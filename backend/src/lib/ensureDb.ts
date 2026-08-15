import type { NextFunction, Request, Response } from "express";
import { prisma } from "./prisma.js";
import { hashPassword } from "./password.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "Session" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sid" TEXT NOT NULL,
  "data" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "userId" TEXT,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sid_key" ON "Session"("sid");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");

CREATE TABLE IF NOT EXISTS "Space" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "courseCode" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "accent" TEXT NOT NULL DEFAULT 'forest',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Space_userId_idx" ON "Space"("userId");

CREATE TABLE IF NOT EXISTS "Document" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "spaceId" TEXT,
  "title" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "extractedText" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("spaceId") REFERENCES "Space" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Document_userId_idx" ON "Document"("userId");
CREATE INDEX IF NOT EXISTS "Document_spaceId_idx" ON "Document"("spaceId");

CREATE TABLE IF NOT EXISTS "Quiz" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Question" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "quizId" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "options" TEXT NOT NULL,
  "correctIndex" INTEGER NOT NULL,
  "explanation" TEXT NOT NULL DEFAULT '',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Attempt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "quizId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "answers" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
`;

let ready: Promise<void> | null = null;

async function init() {
  for (const statement of SCHEMA.split(";").map((part) => part.trim()).filter(Boolean)) {
    await prisma.$executeRawUnsafe(`${statement};`);
  }
  const email = "student@studyforge.app";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await prisma.user.create({
      data: {
        name: "Ada Okonkwo",
        email,
        passwordHash: await hashPassword("StudyForge2026!"),
      },
    });
  }
}

export function ensureDb(_req: Request, _res: Response, next: NextFunction) {
  if (!ready) ready = init();
  ready.then(() => next()).catch(next);
}
