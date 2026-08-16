import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config, configError } from "./config.js";
import { attachSupabaseUser, errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";
import { spacesRouter } from "./routes/spaces.js";
import { documentsRouter } from "./routes/documents.js";
import { quizzesRouter } from "./routes/quizzes.js";
import { attemptsRouter } from "./routes/attempts.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");

  if (!config) {
    app.get("/api/health", (_req, res) => {
      res.status(500).json({ success: false, error: { message: configError ?? "Missing environment.", code: "CONFIG" } });
    });
    app.use((req, res, next) => {
      if (req.path.startsWith("/api")) {
        res.status(500).json({
          success: false,
          error: {
            message: `Server misconfigured: ${configError ?? "check Vercel environment variables."}`,
            code: "CONFIG",
          },
        });
        return;
      }
      next();
    });
    return app;
  }

  if (config.isProd) app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(attachSupabaseUser);

  app.get("/api/health", (_req, res) =>
    res.json({ success: true, data: { ok: true, vercel: Boolean(process.env.VERCEL) } }),
  );
  app.use("/api/auth", authRouter);
  app.use("/api", spacesRouter, documentsRouter, quizzesRouter, attemptsRouter);

  app.use(errorHandler);
  return app;
}
