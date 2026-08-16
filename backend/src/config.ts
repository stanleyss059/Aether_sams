import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

const isProd = process.env.NODE_ENV === "production";
const envSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(4001),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
    DIRECT_URL: z.string().min(1).optional(),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET must contain at least 32 characters."),
    SUPABASE_URL: z.url("SUPABASE_URL must be a valid URL."),
    SUPABASE_ANON_KEY: z.string().min(20, "SUPABASE_ANON_KEY is required."),
    FRONTEND_URL: z.url().optional(),
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
  });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid StudyForge environment: ${details}`);
}

const env = parsed.data;
export const config = {
  isProd,
  port: env.PORT,
  sessionSecret: env.SESSION_SECRET,
  supabaseUrl: env.SUPABASE_URL,
  supabaseAnonKey: env.SUPABASE_ANON_KEY,
  frontendUrl:
    env.FRONTEND_URL ??
    (env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : env.VERCEL_URL
        ? `https://${env.VERCEL_URL}`
        : "http://localhost:5174"),
  openaiKey: env.OPENAI_API_KEY,
  openaiBaseUrl: env.OPENAI_BASE_URL,
  openaiModel: env.OPENAI_MODEL,
  aiTimeoutMs: env.AI_TIMEOUT_MS,
};
