import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

export const config = {
  isProd: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 4001),
  sessionSecret: process.env.SESSION_SECRET || "studyforge-dev-session-secret-32ch",
  frontendUrl:
    process.env.FRONTEND_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:5174"),
  openaiKey: process.env.OPENAI_API_KEY ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  uploadDir: process.env.VERCEL ? path.join("/tmp", "studyforge-uploads") : (process.env.UPLOAD_DIR ?? "uploads"),
};
