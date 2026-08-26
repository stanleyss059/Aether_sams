import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api";
import {
  liveApi,
  readLiveQuestions,
  readLiveSnapshot,
  readLiveToken,
  writeLiveQuestions,
  writeLiveToken,
} from "../live";
import {
  isFresherSnapshot,
  pollIntervalMs,
  type LiveQuestionCard,
  type LiveSnapshot,
} from "./types";

export function useLiveSession(sessionId: string | undefined) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(() =>
    sessionId ? readLiveSnapshot(sessionId) : null,
  );
  const [questionBank, setQuestionBank] = useState<LiveQuestionCard[]>(() => {
    if (!sessionId) return [];
    const fromSnap = readLiveSnapshot(sessionId)?.questions;
    if (fromSnap?.length) return fromSnap;
    return readLiveQuestions(sessionId);
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const snapshotRef = useRef<LiveSnapshot | null>(null);
  const bankRef = useRef<LiveQuestionCard[]>([]);
  const pendingIndexRef = useRef<number | null>(null);
  const fetchGen = useRef(0);
  const hasDeck = useRef(questionBank.length > 0);

  snapshotRef.current = snapshot;
  bankRef.current = questionBank;

  const applySnapshot = useCallback((data: LiveSnapshot) => {
    if (
      pendingIndexRef.current != null &&
      data.status === "QUESTION" &&
      !data.you?.answered
    ) {
      return;
    }
    if (!isFresherSnapshot(snapshotRef.current, data)) return;
    if (sessionId) {
      if (data.playerToken) writeLiveToken(sessionId, data.playerToken);
      if (data.questions.length) {
        hasDeck.current = true;
        setQuestionBank(data.questions);
        bankRef.current = data.questions;
        writeLiveQuestions(sessionId, data.questions);
      }
    }
    snapshotRef.current = data;
    setSnapshot(data);
    if (data.you?.answered || data.status !== "QUESTION") {
      pendingIndexRef.current = null;
      setPendingIndex(null);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const cached = readLiveQuestions(sessionId);
    setQuestionBank(cached);
    bankRef.current = cached;
    hasDeck.current = cached.length > 0;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer: number | undefined;
    const gen = ++fetchGen.current;

    async function poll() {
      try {
        const light = hasDeck.current ? "?light=1" : "";
        const data = await liveApi<LiveSnapshot>(sessionId!, `/api/live/${sessionId}${light}`);
        if (cancelled || gen !== fetchGen.current) return;
        applySnapshot(data);
        setError("");
        const delay = pollIntervalMs(data.status, Boolean(data.you?.answered));
        if (delay != null) timer = window.setTimeout(poll, delay);
      } catch (err) {
        if (cancelled || gen !== fetchGen.current) return;
        setError(err instanceof Error ? err.message : "Could not load this live quiz.");
        timer = window.setTimeout(poll, 1_200);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [sessionId, applySnapshot]);

  useEffect(() => {
    if (!sessionId || snapshot?.status !== "QUESTION" || !snapshot.endsAt || snapshot.you?.answered) return;
    const endsAtMs = new Date(snapshot.endsAt).getTime();
    const wait = Math.max(0, endsAtMs - Date.now());
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const light = hasDeck.current ? "?light=1" : "";
          const data = await liveApi<LiveSnapshot>(sessionId, `/api/live/${sessionId}${light}`);
          applySnapshot(data);
        } catch {
          // Regular poll loop will retry.
        }
      })();
    }, wait + 30);
    return () => window.clearTimeout(timer);
  }, [sessionId, snapshot?.status, snapshot?.endsAt, snapshot?.questionIndex, snapshot?.you?.answered, applySnapshot]);

  const joined = Boolean(sessionId && (snapshot?.you || (sessionId && readLiveToken(sessionId))));

  async function join(name: string) {
    if (!sessionId) return;
    setBusy(true);
    setError("");
    try {
      const data = await liveApi<{ playerToken: string; snapshot?: LiveSnapshot }>(
        sessionId,
        `/api/live/${sessionId}/join`,
        {
          method: "POST",
          body: JSON.stringify({ name }),
        },
      );
      writeLiveToken(sessionId, data.playerToken);
      if (data.snapshot) {
        applySnapshot(data.snapshot);
      } else {
        const fresh = await liveApi<LiveSnapshot>(sessionId, `/api/live/${sessionId}`);
        applySnapshot(fresh);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not join.");
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (!sessionId) return;
    setBusy(true);
    setError("");
    try {
      const data = await liveApi<LiveSnapshot>(sessionId, `/api/live/${sessionId}/start`, {
        method: "POST",
      });
      applySnapshot(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start.");
    } finally {
      setBusy(false);
    }
  }

  async function answer(index: number) {
    const current = snapshotRef.current;
    if (!sessionId || current?.status !== "QUESTION" || !current.you) return;
    setPendingIndex(index);
    setError("");
    applySnapshot({
      ...current,
      endsAt: null,
      durationMs: null,
      you: { ...current.you, selectedIndex: index },
      answeredCount: current.you.answered
        ? current.answeredCount
        : (current.answeredCount ?? 0) + 1,
      ranking: current.ranking.map((row) =>
        row.id === current.you!.id ? { ...row, answered: true } : row,
      ),
    });
    pendingIndexRef.current = index;
    try {
      const data = await liveApi<{
        selectedIndex: number;
        grade?: {
          selectedIndex: number;
          correct: boolean;
          points: number;
          score: number;
          correctIndex: number;
          explanation: string;
          status: LiveSnapshot["status"];
          answeredCount: number;
          playerCount: number;
          questionId: string;
        };
        snapshot?: LiveSnapshot;
      }>(sessionId, `/api/live/${sessionId}/answer`, {
        method: "POST",
        body: JSON.stringify({
          selectedIndex: index,
          questionId: current.question?.id ?? bankRef.current[current.questionIndex]?.id,
        }),
      });
      if (data.grade) {
        const grade = data.grade;
        applySnapshot({
          ...current,
          status: grade.status,
          answeredCount: grade.answeredCount,
          playerCount: grade.playerCount,
          endsAt: null,
          durationMs: null,
          you: {
            ...current.you,
            selectedIndex: grade.selectedIndex,
            answered: true,
            correct: grade.correct,
            points: grade.points,
            score: grade.score,
          },
          ranking: current.ranking.map((row) =>
            row.id === current.you.id
              ? {
                  ...row,
                  answered: true,
                  score: grade.score,
                  correct: grade.status === "REVEAL" ? grade.correct : null,
                  points: grade.status === "REVEAL" ? grade.points : null,
                }
              : row,
          ),
          question: current.question
            ? {
                ...current.question,
                id: grade.questionId || current.question.id,
                correctIndex: grade.correctIndex,
                explanation: grade.explanation,
              }
            : {
                id: grade.questionId,
                prompt: bankRef.current[current.questionIndex]?.prompt ?? "",
                options: bankRef.current[current.questionIndex]?.options ?? [],
                correctIndex: grade.correctIndex,
                explanation: grade.explanation,
              },
        });
      } else if (data.snapshot) {
        applySnapshot(data.snapshot);
      }
    } catch (err) {
      pendingIndexRef.current = null;
      applySnapshot(current);
      setPendingIndex(null);
      setError(err instanceof ApiError ? err.message : "Could not submit that answer.");
    }
  }

  async function skipReveal() {
    if (!sessionId) return;
    const current = snapshotRef.current;
    if (current?.hasMore) {
      const nextIndex = current.questionIndex + 1;
      applySnapshot({
        ...current,
        status: "QUESTION",
        questionIndex: nextIndex,
        answeredCount: 0,
        endsAt: new Date(Date.now() + 20_000).toISOString(),
        durationMs: 20_000,
        ranking: current.ranking.map((row) => ({
          ...row,
          answered: false,
          correct: null,
          points: null,
        })),
        you: current.you
          ? { ...current.you, selectedIndex: null, answered: false, correct: null, points: null }
          : null,
        question: bankRef.current[nextIndex]
          ? {
              ...bankRef.current[nextIndex]!,
              correctIndex: null,
              explanation: null,
            }
          : current.question,
      });
    }
    setBusy(true);
    setError("");
    try {
      const data = await liveApi<LiveSnapshot>(sessionId, `/api/live/${sessionId}/next`, {
        method: "POST",
      });
      applySnapshot(data);
    } catch (err) {
      if (current) applySnapshot(current);
      setError(err instanceof ApiError ? err.message : "Could not continue.");
    } finally {
      setBusy(false);
    }
  }

  return {
    snapshot,
    questionBank,
    error,
    busy,
    pendingIndex,
    joined,
    join,
    start,
    answer,
    skipReveal,
  };
}
