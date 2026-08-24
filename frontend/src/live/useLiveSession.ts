import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "../api";
import {
  liveApi,
  readLiveQuestions,
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
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [questionBank, setQuestionBank] = useState<LiveQuestionCard[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const snapshotRef = useRef<LiveSnapshot | null>(null);
  const fetchGen = useRef(0);

  snapshotRef.current = snapshot;

  const applySnapshot = useCallback((data: LiveSnapshot) => {
    if (!isFresherSnapshot(snapshotRef.current, data)) return;
    if (sessionId) {
      if (data.playerToken) writeLiveToken(sessionId, data.playerToken);
      if (data.questions.length) {
        setQuestionBank(data.questions);
        writeLiveQuestions(sessionId, data.questions);
      }
    }
    snapshotRef.current = data;
    setSnapshot(data);
    if (data.you?.selectedIndex != null || data.status !== "QUESTION") {
      setPendingIndex(null);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    setQuestionBank(readLiveQuestions(sessionId));
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer: number | undefined;
    const gen = ++fetchGen.current;

    async function poll() {
      try {
        const data = await liveApi<LiveSnapshot>(sessionId!, `/api/live/${sessionId}`);
        if (cancelled || gen !== fetchGen.current) return;
        applySnapshot(data);
        setError("");
        const delay = pollIntervalMs(data.status);
        if (delay != null) timer = window.setTimeout(poll, delay);
      } catch (err) {
        if (cancelled || gen !== fetchGen.current) return;
        setError(err instanceof Error ? err.message : "Could not load this live quiz.");
        timer = window.setTimeout(poll, 2_000);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [sessionId, applySnapshot]);

  // When the local timer hits 0, force a sync so REVEAL isn't delayed by the poll cadence.
  useEffect(() => {
    if (!sessionId || snapshot?.status !== "QUESTION" || !snapshot.endsAt) return;
    const endsAtMs = new Date(snapshot.endsAt).getTime();
    const wait = Math.max(0, endsAtMs - Date.now());
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await liveApi<LiveSnapshot>(sessionId, `/api/live/${sessionId}`);
          applySnapshot(data);
        } catch {
          // Regular poll loop will retry.
        }
      })();
    }, wait + 50);
    return () => window.clearTimeout(timer);
  }, [sessionId, snapshot?.status, snapshot?.endsAt, snapshot?.questionIndex, applySnapshot]);

  const joined = Boolean(sessionId && (snapshot?.you || (sessionId && readLiveToken(sessionId))));

  async function join(name: string) {
    if (!sessionId) return;
    setBusy(true);
    setError("");
    try {
      const data = await liveApi<{ playerToken: string }>(sessionId, `/api/live/${sessionId}/join`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      writeLiveToken(sessionId, data.playerToken);
      const fresh = await liveApi<LiveSnapshot>(sessionId, `/api/live/${sessionId}`);
      applySnapshot(fresh);
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
    if (!sessionId || snapshotRef.current?.status !== "QUESTION") return;
    setPendingIndex(index);
    setError("");
    try {
      const data = await liveApi<{ snapshot: LiveSnapshot }>(sessionId, `/api/live/${sessionId}/answer`, {
        method: "POST",
        body: JSON.stringify({ selectedIndex: index }),
      });
      applySnapshot(data.snapshot);
    } catch (err) {
      setPendingIndex(null);
      setError(err instanceof ApiError ? err.message : "Could not submit that answer.");
    }
  }

  async function skipReveal() {
    if (!sessionId) return;
    setBusy(true);
    setError("");
    try {
      const data = await liveApi<LiveSnapshot>(sessionId, `/api/live/${sessionId}/next`, {
        method: "POST",
      });
      applySnapshot(data);
    } catch (err) {
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
