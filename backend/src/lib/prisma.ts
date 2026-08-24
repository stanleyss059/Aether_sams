import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function databaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return url;
  // Serverless instances should keep a single Prisma connection. The local
  // long-running API needs a few, or bulk uploads and background notes starve.
  if (process.env.VERCEL) return url;
  const [base, query = ""] = url.split("?");
  const params = new URLSearchParams(query);
  if (!params.has("connection_limit") || params.get("connection_limit") === "1") {
    params.set("connection_limit", "5");
  }
  if (!params.has("pool_timeout") || Number(params.get("pool_timeout")) < 20) {
    params.set("pool_timeout", "20");
  }
  return `${base}?${params.toString()}`;
}

function createClient() {
  const url = databaseUrl();
  return new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
}

// Singleton keeps full generated PrismaClient typings (liveSession, livePlayer, …).
export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}
