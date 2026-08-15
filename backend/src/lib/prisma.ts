import { PrismaClient } from "@prisma/client";

if (process.env.VERCEL) {
  const url = process.env.DATABASE_URL ?? "";
  if (!url || url.startsWith("file:")) {
    process.env.DATABASE_URL = "file:/tmp/studyforge.db";
  }
}

export const prisma = new PrismaClient();
