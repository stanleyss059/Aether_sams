import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { Errors } from "../lib/errors.js";
import { asyncHandler, requireAuth } from "../middleware/errorHandler.js";

export const attemptsRouter = Router();
attemptsRouter.use(requireAuth);

attemptsRouter.post(
  "/quizzes/:id/attempt",
  asyncHandler(async (req, res) => {
    const body = z.object({ answers: z.record(z.string(), z.number().int().min(0).max(3)) }).parse(req.body);
    const quiz = await prisma.quiz.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { questions: true },
    });
    if (!quiz) throw Errors.notFound("Quiz not found.");

    let score = 0;
    const review = quiz.questions.map((question) => {
      const selected = body.answers[question.id];
      const correct = selected === question.correctIndex;
      if (correct) score += 1;
      return {
        id: question.id,
        prompt: question.prompt,
        options: JSON.parse(question.options) as string[],
        selectedIndex: selected ?? null,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
        correct,
      };
    });
    const attempt = await prisma.attempt.create({
      data: {
        quizId: quiz.id,
        userId: req.user!.id,
        answers: JSON.stringify(body.answers),
        score,
        total: quiz.questions.length,
      },
    });
    res.status(201).json({
      success: true,
      data: { attemptId: attempt.id, score, total: quiz.questions.length, review },
    });
  }),
);
