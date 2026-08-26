import { api } from "./api";
import type { NavigateFunction } from "react-router-dom";
import type { LiveQuestionCard, LiveSnapshot } from "./live/types";

export const liveTokenKey = (sessionId: string) => `aether.live.${sessionId}`;
const liveQuestionsKey = (sessionId: string) => `aether.live.questions.${sessionId}`;
const liveSnapshotKey = (sessionId: string) => `aether.live.snapshot.${sessionId}`;

export type { LiveQuestionCard, LiveSnapshot } from "./live/types";

export function readLiveQuestions(sessionId: string): LiveQuestionCard[] {
  try {
    const raw = sessionStorage.getItem(liveQuestionsKey(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LiveQuestionCard[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLiveQuestions(sessionId: string, questions: LiveQuestionCard[]) {
  if (!questions.length) return;
  try {
    sessionStorage.setItem(liveQuestionsKey(sessionId), JSON.stringify(questions));
  } catch {
    // Storage may be unavailable in private mode.
  }
}

export function readLiveSnapshot(sessionId: string): LiveSnapshot | null {
  try {
    const raw = sessionStorage.getItem(liveSnapshotKey(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as LiveSnapshot;
  } catch {
    return null;
  }
}

export function writeLiveSnapshot(sessionId: string, snapshot: LiveSnapshot) {
  try {
    sessionStorage.setItem(liveSnapshotKey(sessionId), JSON.stringify(snapshot));
  } catch {
    // Storage may be unavailable in private mode.
  }
}

export function readLiveToken(sessionId: string) {
  try {
    return localStorage.getItem(liveTokenKey(sessionId));
  } catch {
    return null;
  }
}

export function writeLiveToken(sessionId: string, token: string) {
  localStorage.setItem(liveTokenKey(sessionId), token);
}

export async function liveApi<T>(sessionId: string, path: string, options: RequestInit = {}) {
  return api<T>(path, {
    ...options,
    skipAuthLogout: true,
    liveToken: readLiveToken(sessionId),
  });
}

export async function createLiveSession(quizId: string) {
  const session = await api<{
    id: string;
    playerToken: string;
    snapshot?: LiveSnapshot;
  }>("/api/live", {
    method: "POST",
    body: JSON.stringify({ quizId }),
  });
  writeLiveToken(session.id, session.playerToken);
  if (session.snapshot?.questions?.length) {
    writeLiveQuestions(session.id, session.snapshot.questions);
  }
  if (session.snapshot) writeLiveSnapshot(session.id, session.snapshot);
  return session.id;
}

export async function openGeneratedQuiz(navigate: NavigateFunction, quizId: string, live: boolean) {
  if (!live) {
    navigate(`/quizzes/${quizId}`);
    return;
  }
  const sessionId = await createLiveSession(quizId);
  navigate(`/live/${sessionId}`);
}
