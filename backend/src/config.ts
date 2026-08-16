import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Local only: on Vercel, env comes from the project settings (and a missing
// backend/.env would otherwise print dotenv's "injected env (0)" tips in logs).
if (!process.env.VERCEL) {
  dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });
}

const isProd = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(4001),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
    DIRECT_URL: z.string().min(1).optional(),
    SESSION_SECRET: z.string().min(32).optional(),
    SUPABASE_URL: z.url("SUPABASE_URL must be a valid URL."),
    SUPABASE_ANON_KEY: z.string().min(20, "SUPABASE_ANON_KEY is required."),
    FRONTEND_URL: z.string().optional(),
    VERCEL_URL: z.string().optional(),
    VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
    OPENAI_API_KEY: z.string().default(""),
    OPENAI_BASE_URL: z.url().default("https://api.openai.com/v1"),
    OPENAI_MODEL: z.string().min(1).default("gpt-4o-mini"),
    AI_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(55_000).default(45_000),
  })
  .superRefine((env, ctx) => {
    if (isProd && !env.DIRECT_URL) {
      ctx.addIssue({ code: "custom", path: ["DIRECT_URL"], message: "DIRECT_URL is required in production." });
    }
    if (env.DATABASE_URL && !/^postgres(ql)?:\/\//i.test(env.DATABASE_URL)) {
      ctx.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL must start with postgresql:// or postgres://",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

export const configError = parsed.success
  ? null
  : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");

function resolveFrontendUrl(env: z.infer<typeof envSchema>) {
  const raw =
    env.FRONTEND_URL ??
    (env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : env.VERCEL_URL
        ? `https://${env.VERCEL_URL}`
        : "http://localhost:5174");
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `https://${raw}`;
}

export const config = parsed.success
  ? {
      isProd,
      port: parsed.data.PORT,
      supabaseUrl: parsed.data.SUPABASE_URL,
      supabaseAnonKey: parsed.data.SUPABASE_ANON_KEY,
      frontendUrl: resolveFrontendUrl(parsed.data),
      openaiKey: parsed.data.OPENAI_API_KEY,
      openaiBaseUrl: parsed.data.OPENAI_BASE_URL,
      openaiModel: parsed.data.OPENAI_MODEL,
      aiTimeoutMs: parsed.data.AI_TIMEOUT_MS,
    }
  : null;
