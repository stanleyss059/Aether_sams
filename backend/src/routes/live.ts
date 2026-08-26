import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { Errors } from "../lib/errors.js";
import { logAudit } from "../lib/audit.js";
import {
  advanceLiveSession,
  assertLiveHost,
  gradeLiveAnswer,
  liveViewer,
  loadLiveSession,
  newPlayerToken,
  serializeLive,
  syncLiveStatus,
} from "../lib/live.js";
import { asyncHandler, requireAuth } from "../middleware/errorHandler.js";

const nameSchema = z.string().trim().min(1).max(24);
const answerSchema = z.object({
  selectedIndex: z.number().int().min(0).max(3),
  questionId: z.string().min(1).optional(),
});

export const liveRouter = Router();

liveRouter.post(
  "/live",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = z.object({ quizId: z.string().min(1) }).parse(req.body);
    const quiz = await prisma.quiz.findFirst({
      where: { id: body.quizId, userId: req.user!.id },
      select: {
        id: true,
        title: true,
        questions: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!quiz) throw Errors.notFound("Quiz not found.");
    if (quiz.questions.length < 1) throw Errors.validation("This quiz has no questions yet.");

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
    const snapshot = serializeLive(
      {
        id: session.id,
        hostUserId: req.user!.id,
        status: "LOBBY",
        questionIndex: 0,
        questionStartedAt: null,
        quiz: { id: quiz.id, title: quiz.title, questions: quiz.questions },
        players: session.players,
        answers: [],
      },
      host,
      { includeDeck: true },
    );
    res.status(201).json({
      success: true,
      data: { id: session.id, playerToken: host.token, playerId: host.id, snapshot },
    });
  }),
);

/** Poll this endpoint — the server advances phases automatically. */
liveRouter.get(
  "/live/:id",
  asyncHandler(async (req, res) => {
    const session = await syncLiveStatus(req.params.id);
    const viewer = await liveViewer(req, session.id);
    const includeDeck = req.query.light !== "1";
    res.json({ success: true, data: serializeLive(session, viewer, { includeDeck }) });
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
        data: {
          playerId: existing.id,
          playerToken: existing.token,
          name: existing.displayName,
          snapshot: serializeLive(session, existing, { includeDeck: true }),
        },
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
    const joined = { ...session, players: [...session.players, player] };
    res.status(201).json({
      success: true,
      data: {
        playerId: player.id,
        playerToken: player.token,
        name: player.displayName,
        snapshot: serializeLive(joined, player, { includeDeck: true }),
      },
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

    const questionStartedAt = new Date();
    await prisma.liveSession.update({
      where: { id: session.id },
      data: { status: "QUESTION", questionIndex: 0, questionStartedAt },
    });
    logAudit({
      req,
      action: "live.start",
      entityType: "live_session",
      entityId: session.id,
    });
    res.json({
      success: true,
      data: serializeLive(
        { ...session, status: "QUESTION", questionIndex: 0, questionStartedAt },
        viewer,
      ),
    });
  }),
);

liveRouter.post(
  "/live/:id/answer",
  asyncHandler(async (req, res) => {
    const body = answerSchema.parse(req.body);
    const grade = await gradeLiveAnswer(req, req.params.id, body.selectedIndex, body.questionId);
    res.status(201).json({ success: true, data: { selectedIndex: grade.selectedIndex, grade } });
  }),
);

liveRouter.post(
  "/live/:id/next",
  asyncHandler(async (req, res) => {
    const viewer = await liveViewer(req, req.params.id);
    const session = await loadLiveSession(req.params.id);
    assertLiveHost(session, viewer, req);
    const fresh = await advanceLiveSession(session.id);
    res.json({ success: true, data: serializeLive(fresh, viewer, { includeDeck: false }) });
  }),
);
