import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import { config } from "./config.js";
import { PrismaSessionStore } from "./lib/sessionStore.js";
import { attachSupabaseUser, errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";
import { spacesRouter } from "./routes/spaces.js";
import { documentsRouter } from "./routes/documents.js";
import { quizzesRouter } from "./routes/quizzes.js";
import { attemptsRouter } from "./routes/attempts.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (config.isProd) app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(
    session({
      name: "sf.sid",
      secret: config.sessionSecret,
      store: new PrismaSessionStore(),
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: config.isProd,
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );
  app.use(attachSupabaseUser);

  app.get("/api/health", (_req, res) => res.json({ success: true, data: { ok: true, vercel: Boolean(process.env.VERCEL) } }));
  app.use("/api/auth", authRouter);
  app.use("/api", spacesRouter, documentsRouter, quizzesRouter, attemptsRouter);

  app.use(errorHandler);
  return app;
}
