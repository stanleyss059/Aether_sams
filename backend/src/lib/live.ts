import { randomBytes } from "node:crypto";
import type { Request } from "express";
import { prisma } from "./prisma.js";
import { Errors } from "./errors.js";

export const QUESTION_MS = 20_000;

export type LiveStatus = "LOBBY" | "QUESTION" | "REVEAL" | "FINISHED";

type LiveQuestion = {
  id: string;
  prompt: string;
  options: string;
  correctIndex: number;
  explanation: string;
  sortOrder: number;
};

type LiveQuiz = {
  id: string;
  title: string;
  questions: LiveQuestion[];
};

export type LivePlayerRow = {
  id: string;
  sessionId: string;
  userId: string | null;
  displayName: string;
  token: string;
  isHost: boolean;
  score: number;
  createdAt: Date;
};

type LiveAnswerRow = {
  id: string;
  playerId: string;
  questionId: string;
  selectedIndex: number;
  correct: boolean;
  points: number;
};

export type SessionBundle = {
  id: string;
  hostUserId: string;
  status: LiveStatus;
  questionIndex: number;
  questionStartedAt: Date | null;
  quiz: LiveQuiz;
  players: LivePlayerRow[];
  answers: LiveAnswerRow[];
};

const liveSessionInclude = {
  quiz: {
    include: { questions: { orderBy: { sortOrder: "asc" as const } } },
  },
  players: { orderBy: { createdAt: "asc" as const } },
  answers: true,
} as const;

/** Prisma client may lag schema in the IDE; cast keeps runtime + local types aligned. */
type LivePrisma = {
  liveSession: {
    findUnique(args: {
      where: { id: string };
      include: typeof liveSessionInclude;
    }): Promise<SessionBundle | null>;
    update(args: {
      where: { id: string };
      data: {
        status?: LiveStatus;
        questionIndex?: number;
        questionStartedAt?: Date | null;
      };
    }): Promise<unknown>;
    updateMany(args: {
      where: Record<string, unknown>;
      data: {
        status?: LiveStatus;
        questionIndex?: number;
        questionStartedAt?: Date | null;
      };
    }): Promise<{ count: number }>;
  };
  livePlayer: {
    findFirst(args: {
      where: { sessionId: string; token?: string; userId?: string };
    }): Promise<LivePlayerRow | null>;
  };
};

function liveDb(): LivePrisma {
  return prisma as unknown as LivePrisma;
}

export function newPlayerToken() {
  return randomBytes(32).toString("base64url");
}

export function speedPoints(correct: boolean, elapsedMs: number) {
  if (!correct) return 0;
  const clamped = Math.min(Math.max(elapsedMs, 0), QUESTION_MS);
  return Math.max(100, Math.round(1000 * (1 - clamped / QUESTION_MS / 2)));
}

export function livePlayerToken(req: Request) {
  const header = req.header("x-live-player-token")?.trim();
  return header || "";
}

export function parseOptions(raw: string) {
  return JSON.parse(raw) as string[];
}

export async function loadLiveSession(id: string): Promise<SessionBundle> {
  const session = await liveDb().liveSession.findUnique({
    where: { id },
    include: liveSessionInclude,
  });
  if (!session) throw Errors.notFound("Live quiz not found.");
  return session;
}

function roundAnswers(session: SessionBundle) {
  const question = session.quiz.questions[session.questionIndex];
  if (!question) return [];
  return session.answers.filter((answer) => answer.questionId === question.id);
}

function questionTimedOut(session: SessionBundle, now = Date.now()) {
  if (!session.questionStartedAt) return false;
  return now - session.questionStartedAt.getTime() >= QUESTION_MS;
}

function everyoneAnswered(session: SessionBundle) {
  const answers = roundAnswers(session);
  return session.players.length > 0 && answers.length >= session.players.length;
}

function shouldReveal(session: SessionBundle) {
  if (session.status !== "QUESTION" || !session.questionStartedAt) return false;
  return questionTimedOut(session) || everyoneAnswered(session);
}

/** Advance QUESTION → REVEAL when time is up or everyone answered. Host advances from REVEAL. */
export async function syncLiveStatus(id: string) {
  let session = await loadLiveSession(id);

  if (shouldReveal(session)) {
    await liveDb().liveSession.updateMany({
      where: { id, status: "QUESTION" },
      data: { status: "REVEAL", questionStartedAt: new Date() },
    });
    session = await loadLiveSession(id);
  }

  return session;
}

export async function advanceLiveSession(id: string) {
  const session = await loadLiveSession(id);
  if (session.status !== "REVEAL") {
    throw Errors.validation("Wait until this round finishes before continuing.");
  }

  const last = session.questionIndex >= session.quiz.questions.length - 1;
  await liveDb().liveSession.update({
    where: { id },
    data: last
      ? { status: "FINISHED", questionStartedAt: null }
      : {
          status: "QUESTION",
          questionIndex: session.questionIndex + 1,
          questionStartedAt: new Date(),
        },
  });
  return loadLiveSession(id);
}

export async function liveViewer(req: Request, sessionId: string) {
  const token = livePlayerToken(req);
  if (token) {
    const byToken = await liveDb().livePlayer.findFirst({ where: { sessionId, token } });
    if (byToken) return byToken;
  }
  if (req.user) {
    return liveDb().livePlayer.findFirst({ where: { sessionId, userId: req.user.id } });
  }
  return null;
}

export function assertLiveHost(
  session: { hostUserId: string },
  viewer: { isHost: boolean } | null,
  req: Request,
) {
  if (viewer?.isHost || req.user?.id === session.hostUserId) return;
  throw Errors.forbidden("Only the host can do that.");
}

function phaseMs(status: LiveStatus) {
  if (status === "QUESTION") return QUESTION_MS;
  return null;
}

export function serializeLive(session: SessionBundle, viewer: { id: string; token: string } | null) {
  const questions = session.quiz.questions;
  const question = questions[session.questionIndex] ?? null;
  const showAnswer = session.status === "REVEAL" || session.status === "FINISHED";
  const questionBank = questions.map((item) => ({
    id: item.id,
    prompt: item.prompt,
    options: parseOptions(item.options),
  }));
  const answers = roundAnswers(session);
  const ranked = [...session.players]
    .sort((a, b) => b.score - a.score || a.createdAt.getTime() - b.createdAt.getTime())
    .map((player, index) => {
      const round = answers.find((answer) => answer.playerId === player.id);
      return {
        id: player.id,
        name: player.displayName,
        isHost: player.isHost,
        score: player.score,
        rank: index + 1,
        answered: Boolean(round),
        correct: session.status === "REVEAL" ? (round?.correct ?? false) : null,
        points: session.status === "REVEAL" ? (round?.points ?? 0) : null,
      };
    });

  const yourAnswer = viewer && question
    ? answers.find((answer) => answer.playerId === viewer.id)
    : null;

  const duration = phaseMs(session.status);
  const showRoundResult = session.status === "REVEAL";

  return {
    id: session.id,
    title: session.quiz.title,
    status: session.status,
    isHost: Boolean(
      viewer && session.players.some((player) => player.id === viewer.id && player.isHost),
    ),
    playerToken: viewer?.token ?? null,
    you: viewer
      ? {
          id: viewer.id,
          selectedIndex: yourAnswer?.selectedIndex ?? null,
          score: session.players.find((player) => player.id === viewer.id)?.score ?? 0,
          answered: Boolean(yourAnswer),
          correct: showRoundResult ? (yourAnswer?.correct ?? false) : null,
          points: showRoundResult ? (yourAnswer?.points ?? 0) : null,
        }
      : null,
    players: session.players.map((player) => ({
      id: player.id,
      name: player.displayName,
      isHost: player.isHost,
    })),
    ranking: ranked.map((row) =>
      showRoundResult || session.status === "LOBBY"
        ? row
        : { ...row, correct: null, points: null },
    ),
    answeredCount: answers.length,
    playerCount: session.players.length,
    endsAt:
      duration != null && session.questionStartedAt
        ? new Date(session.questionStartedAt.getTime() + duration).toISOString()
        : null,
    durationMs: duration,
    questionIndex: session.questionIndex,
    questionCount: questions.length,
    questions: questionBank,
    hasMore: session.questionIndex < questions.length - 1,
    question: question
      ? {
          id: question.id,
          prompt: question.prompt,
          options: parseOptions(question.options),
          correctIndex: showAnswer ? question.correctIndex : null,
          explanation: showAnswer ? question.explanation : null,
        }
      : null,
  };
}
