export type LiveStatus = "LOBBY" | "QUESTION" | "REVEAL" | "FINISHED";

export type LiveQuestionCard = {
  id: string;
  prompt: string;
  options: string[];
};

export type LiveRankingRow = {
  id: string;
  name: string;
  isHost: boolean;
  score: number;
  rank: number;
  answered: boolean;
  correct: boolean | null;
  points: number | null;
};

export type LiveSnapshot = {
  id: string;
  title: string;
  status: LiveStatus;
  isHost: boolean;
  playerToken: string | null;
  you: {
    id: string;
    selectedIndex: number | null;
    score: number;
    answered?: boolean;
    correct?: boolean | null;
    points?: number | null;
  } | null;
  players: { id: string; name: string; isHost: boolean }[];
  ranking: LiveRankingRow[];
  endsAt: string | null;
  durationMs: number | null;
  questionIndex: number;
  questionCount: number;
  questions: LiveQuestionCard[];
  hasMore: boolean;
  answeredCount?: number;
  playerCount?: number;
  question: {
    id: string;
    prompt: string;
    options: string[];
    correctIndex: number | null;
    explanation: string | null;
  } | null;
};

export function resolveLiveQuestion(
  snapshot: LiveSnapshot,
  bank: LiveQuestionCard[],
): LiveSnapshot["question"] {
  const cached =
    bank[snapshot.questionIndex] ?? bank.find((item) => item.id === snapshot.question?.id);
  const live = snapshot.question;
  if (!cached && !live) return null;
  const base = cached ?? live!;
  return {
    id: base.id,
    prompt: base.prompt,
    options: base.options,
    correctIndex: live?.correctIndex ?? null,
    explanation: live?.explanation ?? null,
  };
}

export function pollIntervalMs(status: LiveStatus | undefined, answered = false) {
  if (!status || status === "FINISHED") return null;
  if (status === "LOBBY") return 2_000;
  if (status === "REVEAL") return 500;
  if (answered) return 250;
  return 350;
}

const STATUS_RANK: Record<LiveStatus, number> = {
  LOBBY: 0,
  QUESTION: 1,
  REVEAL: 2,
  FINISHED: 3,
};

/** Drop out-of-order poll/answer responses that would rewind the game. */
export function isFresherSnapshot(prev: LiveSnapshot | null, next: LiveSnapshot) {
  if (!prev || prev.id !== next.id) return true;
  if (next.questionIndex !== prev.questionIndex) return next.questionIndex >= prev.questionIndex;
  if (STATUS_RANK[next.status] !== STATUS_RANK[prev.status]) {
    return STATUS_RANK[next.status] >= STATUS_RANK[prev.status];
  }
  const nextAnswered = next.answeredCount ?? 0;
  const prevAnswered = prev.answeredCount ?? 0;
  if (nextAnswered !== prevAnswered) return nextAnswered >= prevAnswered;
  return (next.you?.score ?? 0) >= (prev.you?.score ?? 0);
}
