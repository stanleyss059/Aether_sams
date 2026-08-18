import express, { type Router } from "express";
import cors from "cors";
import helmet from "helmet";
import { config, configError } from "./config.js";

function describe(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

// The routers pull in Prisma, Supabase and the file parsers. Importing them on
// the first request keeps a failure recoverable: it becomes a JSON response
// naming the cause instead of a crashed serverless function.
function apiLoader() {
  let cached: Promise<Router> | null = null;
  return () => {
    if (!cached) {
      cached = import("./api.js")
        .then((module) => module.createApiRouter())
        .catch((error) => {
          cached = null;
          throw error;
        });
    }
    return cached;
  };
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("etag", false);
  if (config?.isProd) app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(
    cors({
      origin: true,
      credentials: true,
      allowedHeaders: ["Authorization", "Content-Type", "X-Aether-Authorization"],
    }),
  );
  const jsonParser = express.json({ limit: "4mb" });
  app.use((req, res, next) => {
    if (req.is("multipart/form-data")) {
      next();
      return;
    }
    jsonParser(req, res, next);
  });
  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.status(config ? 200 : 500).json({
      success: Boolean(config),
      data: {
        ok: Boolean(config),
        vercel: Boolean(process.env.VERCEL),
        present: {
          DATABASE_URL: Boolean(process.env.DATABASE_URL),
          DIRECT_URL: Boolean(process.env.DIRECT_URL),
          SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
          SUPABASE_ANON_KEY: Boolean(process.env.SUPABASE_ANON_KEY),
          SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
          OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
          FRONTEND_URL: Boolean(process.env.FRONTEND_URL),
        },
        storageReady: Boolean(config?.supabaseServiceRoleKey),
      },
      error: config ? undefined : { message: configError ?? "Missing environment.", code: "CONFIG" },
    });
  });

  app.get("/api/health/db", (_req, res) => {
    void (async () => {
      try {
        const { prisma } = await import("./lib/prisma.js");
        const users = await prisma.user.count();
        res.json({ success: true, data: { connected: true, users } });
      } catch (error) {
        console.error("Database health check failed:", error);
        res.status(500).json({ success: false, error: { message: describe(error), code: "DATABASE" } });
      }
    })();
  });

  const loadApi = apiLoader();
  app.use("/api", (req, res, next) => {
    if (!config) {
      res.status(500).json({
        success: false,
        error: {
          message: `Server misconfigured: ${configError ?? "check Vercel environment variables."}`,
          code: "CONFIG",
        },
      });
      return;
    }
    loadApi().then(
      (api) => api(req, res, next),
      (error) => {
        console.error("Failed to initialise API routes:", error);
        res.status(500).json({
          success: false,
          error: { message: `API failed to start: ${describe(error)}`, code: "BOOTSTRAP" },
        });
      },
    );
  });

  return app;
}
