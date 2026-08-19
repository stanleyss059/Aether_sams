import { Router } from "express";
import { attachSupabaseUser, errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";

function useRouter(api: Router, router: unknown, label: string, path?: string) {
  if (typeof router !== "function") {
    throw new Error(`${label} router failed to load.`);
  }
  const mount = router as Router;
  if (path) {
    api.use(path, mount);
    return;
  }
  api.use(mount);
}

export async function createApiRouter(): Promise<Router> {
  const api = Router();
  api.use((req, res, next) => {
    const path = `${req.originalUrl ?? ""} ${req.url ?? ""} ${req.path ?? ""}`.toLowerCase();
    if (
      req.method === "POST" &&
      (path.includes("/documents/prepare") || path.includes("/documents/complete"))
    ) {
      next();
      return;
    }
    attachSupabaseUser(req, res, next);
  });
  api.use("/auth", authRouter);

  try {
    const { adminRouter } = await import("./routes/admin.js");
    useRouter(api, adminRouter, "admin", "/admin");
    const { documentsRouter } = await import("./routes/documents.js");
    const { spacesRouter } = await import("./routes/spaces.js");
    const { quizzesRouter } = await import("./routes/quizzes.js");
    const { attemptsRouter } = await import("./routes/attempts.js");
    useRouter(api, documentsRouter, "documents");
    useRouter(api, spacesRouter, "spaces");
    useRouter(api, quizzesRouter, "quizzes");
    useRouter(api, attemptsRouter, "attempts");
  } catch (error) {
    console.error("Failed to load study routes:", error);
    const message = error instanceof Error ? error.message : String(error);
    api.use((req, res, next) => {
      const url = `${req.originalUrl ?? ""} ${req.path ?? ""}`.toLowerCase();
      if (url.includes("/auth")) {
        next();
        return;
      }
      res.status(500).json({
        success: false,
        error: { message: `API failed to start: ${message}`, code: "BOOTSTRAP" },
      });
    });
  }

  api.use(errorHandler);
  return api;
}
