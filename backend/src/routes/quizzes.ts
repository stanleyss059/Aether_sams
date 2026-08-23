import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { Errors } from "../lib/errors.js";
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
          correctIndex: question.correctIndex,
          explanation: question.explanation,
        })),
      },
    });
  }),
);

quizzesRouter.post(
  "/quizzes/:id/check",
  asyncHandler(async (req, res) => {
    const body = z.object({
      questionId: z.string().min(1),
      selectedIndex: z.number().int().min(0).max(3),
    }).parse(req.body);
    await ownedQuiz(req.user!.id, req.params.id);
    const question = await prisma.question.findFirst({
      where: { id: body.questionId, quizId: req.params.id },
    });
    if (!question) throw Errors.notFound("Question not found.");
    res.json({
      success: true,
      data: {
        questionId: question.id,
        selectedIndex: body.selectedIndex,
        correctIndex: question.correctIndex,
        correct: body.selectedIndex === question.correctIndex,
        explanation: question.explanation,
      },
    });
  }),
);
