import { PrismaClient } from "@prisma/client";

/** Shared Prisma client for StudyForge (includes Space). */
export const prisma = new PrismaClient();
