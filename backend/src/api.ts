import { Router } from "express";
import { attachSupabaseUser, errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/auth.js";
import { spacesRouter } from "./routes/spaces.js";
import { documentsRouter } from "./routes/documents.js";
import { quizzesRouter } from "./routes/quizzes.js";
import { attemptsRouter } from "./routes/attempts.js";

export function createApiRouter(): Router {
  const api = Router();
  api.use(attachSupabaseUser);
  api.use("/auth", authRouter);
  api.use(spacesRouter, documentsRouter, quizzesRouter, attemptsRouter);
  api.use(errorHandler);
  return api;
}
