import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { Errors } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import { ownedQuiz } from "../lib/study.js";
import {
  advanceLiveSession,
  assertLiveHost,
  liveViewer,
  loadLiveSession,
  newPlayerToken,
  QUESTION_MS,
  serializeLive,
  speedPoints,
  syncLiveStatus,
} from "../lib/live.js";
import { asyncHandler, requireAuth } from "../middleware/errorHandler.js";

const nameSchema = z.string().trim().min(1).max(24);
const answerSchema = z.object({
  selectedIndex: z.number().int().min(0).max(3),
});

export const liveRouter = Router();

liveRouter.post(
  "/live",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z.object({ quizId: z.string().min(1) }).parse(req.body);
    const quiz = await ownedQuiz(req.user!.id, body.quizId);
    const count = await prisma.question.count({ where: { quizId: quiz.id } });
    if (count < 1) throw Errors.validation("This quiz has no questions yet.");

    const session = await prisma.liveSession.create({
      data: {
        quizId: quiz.id,
        hostUserId: req.user!.id,
        players: {
          create: {
            userId: req.user!.id,
            displayName: req.user!.name.trim() || "Host",
            token: newPlayerToken(),
            isHost: true,
          },
        },
      },
      include: { players: true },
    });
    const host = session.players[0];
    logAudit({
      req,
      action: "live.create",
      entityType: "live_session",
      entityId: session.id,
      metadata: { quizId: quiz.id },
    });
    res.status(201).json({
      success: true,
      data: { id: session.id, playerToken: host.token, playerId: host.id },
    });
  }),
);

/** Poll this endpoint — the server advances phases automatically. */
liveRouter.get(
  "/live/:id",
  asyncHandler(async (req, res) => {
    const session = await syncLiveStatus(req.params.id);
    const viewer = await liveViewer(req, session.id);
    res.json({ success: true, data: serializeLive(session, viewer) });
  }),
);

liveRouter.post(
  "/live/:id/join",
  asyncHandler(async (req, res) => {
    const name = nameSchema.parse(req.body?.name);
    const session = await syncLiveStatus(req.params.id);
    if (session.status === "FINISHED") throw Errors.validation("This live quiz has already finished.");

    const existing = await liveViewer(req, session.id);
    if (existing) {
      res.json({
        success: true,
        data: { playerId: existing.id, playerToken: existing.token, name: existing.displayName },
      });
      return;
    }

    if (session.players.length >= 50) throw Errors.validation("This live quiz is full.");

    const player = await prisma.livePlayer.create({
      data: {
        sessionId: session.id,
        userId: req.user?.id ?? null,
        displayName: name,
        token: newPlayerToken(),
      },
    });
    res.status(201).json({
      success: true,
      data: { playerId: player.id, playerToken: player.token, name: player.displayName },
    });
  }),
);

liveRouter.post(
  "/live/:id/start",
  asyncHandler(async (req, res) => {
    const session = await syncLiveStatus(req.params.id);
    const viewer = await liveViewer(req, session.id);
    assertLiveHost(session, viewer, req);
    if (session.status !== "LOBBY") throw Errors.validation("This live quiz has already started.");

    await prisma.liveSession.update({
      where: { id: session.id },
      data: { status: "QUESTION", questionIndex: 0, questionStartedAt: new Date() },
    });
    logAudit({
      req,
      action: "live.start",
      entityType: "live_session",
      entityId: session.id,
    });
    const fresh = await loadLiveSession(session.id);
    res.json({ success: true, data: serializeLive(fresh, viewer) });
  }),
);

liveRouter.post(
  "/live/:id/answer",
  asyncHandler(async (req, res) => {
    const body = answerSchema.parse(req.body);
    const session = await syncLiveStatus(req.params.id);
    const viewer = await liveViewer(req, session.id);
    if (!viewer) throw Errors.forbidden("Join this live quiz first.");
    if (session.status !== "QUESTION" || !session.questionStartedAt) {
      throw Errors.validation("Wait for the host to open the next question.");
    }

    const elapsedMs = Date.now() - session.questionStartedAt.getTime();
    if (elapsedMs > QUESTION_MS) throw Errors.validation("Time is up.");

    const question = session.quiz.questions[session.questionIndex];
    if (!question) throw Errors.notFound("Question not found.");

    const already = session.answers.find(
      (answer) => answer.playerId === viewer.id && answer.questionId === question.id,
    );
    if (already) throw Errors.conflict("You already answered this question.");

    const correct = body.selectedIndex === question.correctIndex;
    const points = speedPoints(correct, elapsedMs);
    const answer = await prisma.$transaction(async (tx) => {
      const created = await tx.liveAnswer.create({
        data: {
          sessionId: session.id,
          playerId: viewer.id,
          questionId: question.id,
          selectedIndex: body.selectedIndex,
          correct,
          points,
          elapsedMs,
        },
      });
      if (points > 0) {
        await tx.livePlayer.update({
          where: { id: viewer.id },
          data: { score: { increment: points } },
        });
      }
      return created;
    });

    const fresh = await syncLiveStatus(session.id);
    const you = await liveViewer(req, session.id);
    res.status(201).json({
      success: true,
      data: {
        selectedIndex: answer.selectedIndex,
        snapshot: serializeLive(fresh, you),
      },
    });
  }),
);

/** Host can skip the reveal wait and go to the next question immediately. */
liveRouter.post(
  "/live/:id/next",
  asyncHandler(async (req, res) => {
    const session = await syncLiveStatus(req.params.id);
    const viewer = await liveViewer(req, session.id);
    assertLiveHost(session, viewer, req);
    const fresh = await advanceLiveSession(session.id);
    res.json({ success: true, data: serializeLive(fresh, viewer) });
  }),
);
