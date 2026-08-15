import express, { type RequestHandler, type Router } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { config } from "./config.js";
import { userSession } from "./lib/userSession.js";
import { errorHandler } from "./middleware/errorHandler.js";

function lazy(load: () => Promise<Router>): RequestHandler {
  let router: Router | undefined;
  let pending: Promise<Router> | undefined;
  return (req, res, next) => {
    const run = (mounted: Router) => mounted(req, res, next);
    if (router) {
      run(router);
      return;
    }
    pending ??= load()
      .then((mounted) => {
        router = mounted;
        return mounted;
      })
      .catch((error) => {
        pending = undefined;
        throw error;
      });
    pending.then(run).catch(next);
  };
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(userSession(config.sessionSecret, config.isProd));

  app.get("/api/health", (_req, res) => res.json({ success: true, data: { ok: true, vercel: Boolean(process.env.VERCEL) } }));
  app.get("/api/auth/me", (req, res) => {
    res.json({ success: true, data: { user: req.session.user ?? null } });
  });
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => undefined);
    res.json({ success: true, data: { ok: true } });
  });

  app.use(
    "/api/auth",
    lazy(async () => {
      const { ensureDb } = await import("./lib/ensureDb.js");
      const { authRouter } = await import("./routes/auth.js");
      const router = express.Router();
      router.use(ensureDb);
      router.use(authRouter);
      return router;
    }),
  );

  app.use(
    "/api",
    lazy(async () => {
      const { ensureDb } = await import("./lib/ensureDb.js");
      const { studyRouter } = await import("./routes/study.js");
      const router = express.Router();
      router.use(ensureDb);
      router.use(studyRouter);
      return router;
    }),
  );

  app.use(errorHandler);
  return app;
}
