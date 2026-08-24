import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { Errors } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import { generateQuizFromTopic } from "../lib/ai.js";
import { accessibleQuiz } from "../lib/study.js";
import { asyncHandler, auditFailures, requireAuth } from "../middleware/errorHandler.js";

const quizCountSchema = z.coerce.number().int().min(4).max(50).default(25);
const topicBodySchema = z.object({
  topic: z.string().trim().min(3).max(120),
  count: quizCountSchema.optional(),
});

export const quizzesRouter = Router();
quizzesRouter.use((req, res, next) => {
  const path = `${req.originalUrl ?? ""} ${req.url ?? ""} ${req.path ?? ""}`.toLowerCase();
  if (!path.includes("/quizzes")) {
    next();
    return;
  }
  requireAuth(req, res, next);
});

quizzesRouter.get(
  "/quizzes",
  asyncHandler(async (req, res) => {
    const quizzes = await prisma.quiz.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      include: {
        document: { select: { id: true, title: true } },
        _count: { select: { questions: true, attempts: true } },
      },
    });
    res.json({
      success: true,
      data: quizzes.map((quiz) => ({
        id: quiz.id,
        title: quiz.title,
        documentId: quiz.documentId,
        documentTitle: quiz.document?.title ?? null,
        questionCount: quiz._count.questions,
        attemptCount: quiz._count.attempts,
        createdAt: quiz.createdAt,
      })),
    });
  }),
);

quizzesRouter.post(
  "/quizzes/topic",
  auditFailures("quiz.generate", "quiz", {
    metadata: (req) => ({ topic: req.body?.topic, questionCount: req.body?.count, source: "topic" }),
  }),
  asyncHandler(async (req, res) => {
    const body = topicBodySchema.parse(req.body);
    const count = body.count ?? 25;
    const generated = await generateQuizFromTopic(body.topic, count);
    const quiz = await prisma.quiz.create({
      data: {
        userId: req.user!.id,
        title: `Quiz · ${body.topic}`,
        questions: {
          create: generated.questions.map((question, index) => ({
            prompt: question.question,
            options: JSON.stringify(question.options),
            correctIndex: question.correctIndex,
            explanation: question.explanation,
            sortOrder: index,
          })),
        },
      },
      include: { questions: true },
    });
    logAudit({
      req,
      action: "quiz.generate",
      entityType: "quiz",
      entityId: quiz.id,
      metadata: { topic: body.topic, questionCount: quiz.questions.length, source: "topic" },
    });
    res.status(201).json({
      success: true,
      data: { quizId: quiz.id, questionCount: quiz.questions.length, title: quiz.title },
    });
  }),
);

quizzesRouter.get(
  "/quizzes/:id",
  asyncHandler(async (req, res) => {
    await accessibleQuiz(req.params.id);
    const quiz = await prisma.quiz.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        questions: { orderBy: { sortOrder: "asc" } },
        document: { select: { title: true } },
        user: { select: { name: true } },
      },
    });
    res.json({
      success: true,
      data: {
        id: quiz.id,
        title: quiz.title,
        documentId: quiz.documentId,
        documentTitle: quiz.document?.title ?? null,
        isOwner: quiz.userId === req.user!.id,
        authorName: quiz.user.name,
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
    const body = z
      .object({
        questionId: z.string().min(1),
        selectedIndex: z.number().int().min(0).max(3),
      })
      .parse(req.body);
    await accessibleQuiz(req.params.id);
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
