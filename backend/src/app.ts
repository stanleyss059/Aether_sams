import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { ensureDb } from "./lib/ensureDb.js";
import { userSession } from "./lib/userSession.js";
import { authRouter } from "./routes/auth.js";
import { studyRouter } from "./routes/study.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(userSession(config.sessionSecret, config.isProd));
  app.use(ensureDb);
  app.get("/api/health", (_req, res) => res.json({ success: true, data: { ok: true } }));
  app.use("/api/auth", authRouter);
  app.use("/api", studyRouter);
  app.use(errorHandler);
  return app;
}
