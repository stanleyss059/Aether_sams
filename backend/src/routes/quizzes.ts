import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { ownedQuiz } from "../lib/study.js";
import { asyncHandler, requireAuth } from "../middleware/errorHandler.js";

export const quizzesRouter = Router();
quizzesRouter.use(requireAuth);

quizzesRouter.get(
  "/quizzes/:id",
  asyncHandler(async (req, res) => {
    await ownedQuiz(req.user!.id, req.params.id);
    const quiz = await prisma.quiz.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { questions: { orderBy: { sortOrder: "asc" } }, document: { select: { title: true } } },
    });
    res.json({
      success: true,
      data: {
        id: quiz.id,
        title: quiz.title,
        documentId: quiz.documentId,
        documentTitle: quiz.document.title,
        questions: quiz.questions.map((question) => ({
          id: question.id,
          prompt: question.prompt,
          options: JSON.parse(question.options) as string[],
        })),
      },
    });
  }),
);
