import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";
import { config } from "./config.js";
import { PrismaSessionStore } from "./lib/sessionStore.js";
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
  app.use(
    session({
      name: "sf.sid",
      secret: config.sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: new PrismaSessionStore(),
      cookie: { httpOnly: true, sameSite: "lax", secure: config.isProd, maxAge: 8 * 60 * 60 * 1000 },
    }),
  );
  app.get("/api/health", (_req, res) => res.json({ success: true, data: { ok: true } }));
  app.use("/api/auth", authRouter);
  app.use("/api", studyRouter);
  app.use(errorHandler);
  return app;
}
