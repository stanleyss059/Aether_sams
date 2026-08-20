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

// Instantiated on first query so a missing query engine surfaces as an API
// error instead of killing the serverless function during module load.
function client(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const url = databaseUrl();
    globalForPrisma.prisma = new PrismaClient(url ? { datasources: { db: { url } } } : undefined);
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    return Reflect.get(client(), property, receiver);
  },
});
