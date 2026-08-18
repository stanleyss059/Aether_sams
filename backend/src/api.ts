import { Router } from "express";
import { attachSupabaseUser, errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";
import { adminRouter } from "./routes/admin.js";
import { spacesRouter } from "./routes/spaces.js";
import { documentsRouter } from "./routes/documents.js";
import { quizzesRouter } from "./routes/quizzes.js";
import { attemptsRouter } from "./routes/attempts.js";

export function createApiRouter(): Router {
  const api = Router();
  api.use((req, res, next) => {
    if (
      req.method === "POST" &&
      (req.path === "/documents/prepare" || req.path === "/documents/complete")
    ) {
      next();
      return;
    }
    attachSupabaseUser(req, res, next);
  });
  api.use("/auth", authRouter);
  api.use("/admin", adminRouter);
  api.use(spacesRouter, documentsRouter, quizzesRouter, attemptsRouter);
  api.use(errorHandler);
  return api;
}
