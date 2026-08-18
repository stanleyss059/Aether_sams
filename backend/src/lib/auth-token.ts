import type { Request } from "express";

function firstHeader(value: string | string[] | undefined) {
  if (!value) return "";
  return Array.isArray(value) ? value[0] ?? "" : value;
}

function parseBearer(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  return raw.toLowerCase().startsWith("bearer ") ? raw.slice(7).trim() : raw;
}

const HEADER_NAMES = ["authorization", "x-aether-authorization"] as const;

function tokenFromBody(req: Request) {
  const raw = req.body?.accessToken;
  if (typeof raw !== "string") return "";
  return parseBearer(raw);
}

/** Read the Supabase JWT from request headers (Vercel-safe). */
export function readAccessToken(req: Request) {
  for (const name of HEADER_NAMES) {
    const token = parseBearer(firstHeader(req.headers[name]));
    if (token) return token;
  }

  const bodyToken = tokenFromBody(req);
  if (bodyToken) return bodyToken;

  const vercelHeaders = firstHeader(req.headers["x-vercel-sc-headers"]);
  if (!vercelHeaders) return "";

  try {
    const parsed = JSON.parse(vercelHeaders) as Record<string, unknown>;
    for (const key of ["Authorization", "authorization", "x-aether-authorization"]) {
      const value = parsed[key];
      if (typeof value === "string") {
        const token = parseBearer(value);
        if (token) return token;
      }
    }
  } catch {
    // Ignore malformed Vercel header bags.
  }

  return "";
}
