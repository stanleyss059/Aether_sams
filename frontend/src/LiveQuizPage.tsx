import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";
import { useLiveSession } from "./live/useLiveSession";
import { resolveLiveQuestion, type LiveRankingRow, type LiveSnapshot } from "./live/types";
import { ShareButton } from "./ShareButton";
import { LoadingState, Spinner } from "./Spinner";

const LETTERS = ["A", "B", "C", "D"] as const;

function usePhaseClock(endsAt: string | null, durationMs: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const tick = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(tick);
  }, [endsAt]);
  if (!endsAt) return { remainingSec: 0, progress: 0, expired: false, remainingMs: 0 };
  const total = durationMs && durationMs > 0 ? durationMs : 20_000;
  const remainingMs = Math.max(0, new Date(endsAt).getTime() - now);
  return {
    remainingSec: Math.ceil(remainingMs / 1000),
    progress: Math.min(1, Math.max(0, remainingMs / total)),
    expired: remainingMs <= 0,
    remainingMs,
  };
}

function PhaseTimer({
  endsAt,
  durationMs,
}: {
  endsAt: string | null;
  durationMs: number | null;
}) {
  const { remainingSec, progress, remainingMs } = usePhaseClock(endsAt, durationMs);
  const urgent = remainingMs > 0 && remainingMs <= 5_000;
  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <span className="text-xs font-bold tracking-[0.18em] text-muted uppercase">Time left</span>
        <span
          className={`font-serif text-4xl tabular-nums leading-none ${
            urgent ? "live-timer-urgent text-danger" : "text-gold"
          }`}
        >
          {remainingSec}
          <span className="ml-1 text-lg font-semibold text-muted">s</span>
        </span>
      </div>
      <div className="h-3.5 overflow-hidden rounded-full bg-parchment ring-1 ring-line">
        <div
          className={`h-full rounded-full transition-[width] duration-100 ease-linear ${
            urgent ? "live-bar-urgent bg-danger" : "bg-gold"
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

function AnswerMeter({ answered, total }: { answered: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((answered / total) * 100)) : 0;
  return (
    <div className="rounded-xl border border-line bg-parchment/80 px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-bold tracking-wide uppercase">
        <span className="text-muted">Answers in</span>
        <span className="tabular-nums text-ink">
          {answered}/{total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface ring-1 ring-line">
        <div
          className="h-full rounded-full bg-forest transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Podium({ rows, youId }: { rows: LiveRankingRow[]; youId?: string | null }) {
  const top = rows.slice(0, 3);
  if (top.length === 0) return null;

  // Visual order: 2nd | 1st | 3rd when we have 3; otherwise keep rank order.
  const slots =
    top.length === 3
      ? [
          { row: top[1]!, place: 2, height: "h-20" },
          { row: top[0]!, place: 1, height: "h-28" },
          { row: top[2]!, place: 3, height: "h-16" },
        ]
      : top.map((row, i) => ({
          row,
          place: i + 1,
          height: i === 0 ? "h-28" : i === 1 ? "h-20" : "h-16",
        }));

  return (
    <div className="live-podium flex items-end justify-center gap-2 sm:gap-3">
      {slots.map(({ row, place, height }, i) => {
        const isYou = row.id === youId;
        const isFirst = place === 1;
        return (
          <div
            key={row.id}
            className="flex min-w-0 flex-1 flex-col items-center"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <p className={`mb-2 max-w-full truncate text-center text-sm font-semibold ${isYou ? "text-forest" : ""}`}>
              {isFirst ? "🏆 " : ""}
              {row.name}
              {isYou ? " (you)" : ""}
            </p>
            <div
              className={`flex w-full flex-col items-center justify-end rounded-t-2xl border border-b-0 border-line px-2 pb-3 pt-4 ${height} ${
                isFirst ? "bg-gold/15" : "bg-surface"
              }`}
            >
              <span className={`font-serif tabular-nums ${isFirst ? "text-3xl text-gold" : "text-2xl text-ink"}`}>
                {row.score}
              </span>
              {row.points != null && row.points > 0 ? (
                <span className="mt-0.5 text-xs font-bold tabular-nums text-forest">+{row.points}</span>
              ) : null}
              <span className="mt-1 text-xs font-bold tracking-wide text-muted uppercase">#{place}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Scoreboard({
  rows,
  youId,
  showPodium = true,
}: {
  rows: LiveRankingRow[];
  youId?: string | null;
  showPodium?: boolean;
}) {
  const rest = showPodium ? rows.slice(3) : rows;
  return (
    <div className="space-y-4">
      {showPodium && rows.length > 0 ? <Podium rows={rows} youId={youId} /> : null}
      <ol className="space-y-2">
        {(showPodium ? rest : rows).map((row, index) => {
          const isYou = row.id === youId;
          const displayRank = showPodium ? index + 4 : row.rank;
          return (
            <li
              key={row.id}
              className={`live-score-row flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                isYou ? "border-forest bg-forest/10" : "border-line bg-surface"
              }`}
              style={{ animationDelay: `${(showPodium ? index + 3 : index) * 55}ms` }}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="w-8 shrink-0 font-serif text-xl text-muted">{displayRank}</span>
                <span className="truncate font-semibold">
                  {row.name}
                  {isYou ? <span className="ml-2 text-xs font-bold text-forest">YOU</span> : null}
                  {row.isHost ? <span className="ml-2 text-xs font-bold text-muted">HOST</span> : null}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className="font-serif text-2xl tabular-nums text-ink">{row.score}</span>
                {row.points != null && row.points > 0 ? (
                  <span className="text-xs font-bold tabular-nums text-forest">+{row.points} this round</span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function YourHud({ snapshot }: { snapshot: LiveSnapshot }) {
  const you = snapshot.you;
  if (!you) return null;
  const rank = snapshot.ranking.find((row) => row.id === you.id)?.rank;
  const roundPoints = you.points != null && you.answered ? you.points : null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
        <span className="text-muted">Your score </span>
        <span className="font-serif text-lg font-semibold tabular-nums">{you.score}</span>
        {roundPoints != null && roundPoints > 0 ? (
          <span className="ml-1 text-xs font-bold text-forest">+{roundPoints}</span>
        ) : null}
      </span>
      {rank != null ? (
        <span className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
          <span className="text-muted">Rank </span>
          <span className="font-serif text-lg font-semibold tabular-nums">#{rank}</span>
        </span>
      ) : null}
    </div>
  );
}

function RoundVerdict({ snapshot, question }: { snapshot: LiveSnapshot; question: LiveSnapshot["question"] }) {
  const you = snapshot.you;
  const correct = you?.correct === true;
  const answered = Boolean(you?.answered);
  const points = you?.points ?? 0;
  const correctIndex = question?.correctIndex;
  const correctLabel =
    question && correctIndex != null
      ? `${LETTERS[correctIndex]} — ${question.options[correctIndex]}`
      : null;

  return (
    <div
      className={`rounded-2xl border px-4 py-4 ${
        !answered
          ? "border-line bg-parchment/80"
          : correct
            ? "border-forest bg-forest/10"
            : "border-danger bg-danger/10"
      }`}
    >
      <p className={`font-serif text-2xl ${correct ? "text-forest" : answered ? "text-danger" : "text-ink"}`}>
        {!answered ? "You didn’t answer" : correct ? "Correct!" : "Wrong"}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums">
        {correct && points > 0 ? `+${points} this round` : answered ? "No points this round" : "0 points this round"}
        <span className="text-muted"> · total {you?.score ?? 0}</span>
      </p>
      {correctLabel ? (
        <p className="mt-2 text-sm text-muted">
          Correct answer: <span className="font-semibold text-ink">{correctLabel}</span>
        </p>
      ) : null}
      {question?.explanation ? (
        <p className="mt-2 text-sm leading-relaxed text-muted">{question.explanation}</p>
      ) : null}
    </div>
  );
}

export function LiveQuizPage() {
  const { id } = useParams();
  const [name, setName] = useState("");
  const [justLocked, setJustLocked] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [resultHold, setResultHold] = useState(false);
  const {
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
  } = useLiveSession(id);

  const question = useMemo(
    () => (snapshot ? resolveLiveQuestion(snapshot, questionBank) : null),
    [snapshot, questionBank],
  );
  const selected = pendingIndex ?? snapshot?.you?.selectedIndex ?? null;
  const lockedIn = Boolean(pendingIndex != null || snapshot?.you?.answered);
  const canAnswer = snapshot?.status === "QUESTION" && !lockedIn && joined;
  const onPersonalResult = resultHold && Boolean(question);
  const onLeaderboard =
    snapshot?.status === "FINISHED"
      ? false
      : snapshot?.you?.answered
        ? showBoard && !resultHold
        : snapshot?.status === "REVEAL";
  const { expired: questionExpired } = usePhaseClock(
    snapshot?.status === "QUESTION" && !lockedIn ? snapshot.endsAt : null,
    snapshot?.durationMs ?? null,
  );
  const path = id ? `/live/${id}` : "/live";
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
  const questionsReady = questionBank.length > 0;
  const questionNumber = snapshot ? Math.min(snapshot.questionIndex + 1, snapshot.questionCount || questionBank.length || 1) : 0;
  const questionTotal = snapshot?.questionCount || questionBank.length;
  const answeredCount =
    snapshot?.answeredCount ?? snapshot?.ranking.filter((row) => row.answered).length ?? 0;
  const playerCount = snapshot?.playerCount ?? snapshot?.players.length ?? 0;

  useEffect(() => {
    setShowBoard(false);
    setResultHold(false);
  }, [snapshot?.questionIndex]);

  useEffect(() => {
    if (!snapshot?.you?.answered) return;
    if (snapshot.status !== "QUESTION" && snapshot.status !== "REVEAL") return;
    setResultHold(true);
    setShowBoard(false);
    const timer = window.setTimeout(() => {
      setResultHold(false);
      setShowBoard(true);
    }, 2_000);
    return () => window.clearTimeout(timer);
  }, [snapshot?.you?.answered, snapshot?.questionIndex]);

  useEffect(() => {
    if (pendingIndex == null) return;
    setJustLocked(true);
    const t = window.setTimeout(() => setJustLocked(false), 500);
    return () => window.clearTimeout(t);
  }, [pendingIndex, snapshot?.questionIndex]);

  async function onJoin(event: FormEvent) {
    event.preventDefault();
    await join(name);
  }

  async function onAnswer(index: number) {
    setJustLocked(true);
    await answer(index);
  }

  if (error && !snapshot) return <p className="p-6 text-danger">{error}</p>;
  if (!snapshot) return <LoadingState className="flex min-h-screen items-center justify-center" />;

  const subtitle =
    snapshot.status === "LOBBY"
      ? "Gather your crew. Share the link, then hit start."
      : snapshot.status === "QUESTION" || resultHold
        ? lockedIn
          ? "Answer locked — here’s how you did."
          : "Faster correct answers score more. Lock in before time runs out!"
        : snapshot.status === "REVEAL"
          ? "Round over — check the standings."
          : "Game over. Crown the champion.";

  return (
    <div className="live-game min-h-screen bg-parchment">
      <header className="border-b border-line bg-surface/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <BrandLogo className="h-8 w-8" />
            <span className="font-serif text-lg text-ink">Aether Live</span>
          </Link>
          <ShareButton path={path} label="Copy link" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        <div className="live-enter flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase">Live arena</p>
            <h1 className="mt-1 font-serif text-3xl">{snapshot.title}</h1>
            <p className="mt-1 text-sm text-muted">{subtitle}</p>
          </div>
          {joined && snapshot.status !== "LOBBY" ? <YourHud snapshot={snapshot} /> : null}
        </div>

        {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

        {!joined && snapshot.status !== "FINISHED" ? (
          <form
            className="live-enter card space-y-3 rounded-2xl border border-line bg-surface p-5"
            onSubmit={onJoin}
          >
            <label className="block text-sm font-semibold">
              Pick your player name
              <input
                className="mt-1 w-full rounded-md border border-line px-3 py-2.5"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={24}
                required
                placeholder="e.g. Sam"
                autoFocus
              />
            </label>
            <p className="text-sm text-muted">No account needed. Jump in with the link.</p>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md bg-forest px-4 py-2.5 font-semibold text-white disabled:opacity-60"
              disabled={busy}
            >
              {busy ? <Spinner size="sm" /> : "Join the game"}
            </button>
          </form>
        ) : null}

        {snapshot.status === "LOBBY" ? (
          <section className="live-enter card space-y-5 rounded-2xl border border-line bg-surface p-5 sm:p-7">
            <div>
              <h2 className="font-serif text-2xl">Waiting room</h2>
              <p className="mt-1 text-sm text-muted">
                {snapshot.players.length} player{snapshot.players.length === 1 ? "" : "s"} ready
              </p>
              <p className="mt-3 break-all rounded-xl bg-parchment px-3 py-2.5 text-sm ring-1 ring-line">
                {shareUrl}
              </p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {snapshot.players.map((player, index) => (
                <li
                  key={player.id}
                  className="live-score-row flex items-center gap-3 rounded-xl border border-line bg-parchment/60 px-3 py-2.5"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest/15 text-sm font-bold text-forest">
                    {player.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 truncate font-semibold">
                    {player.name}
                    {player.isHost ? <span className="ml-2 text-xs font-bold text-forest">HOST</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            {snapshot.isHost ? (
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-md bg-forest px-4 py-3 text-base font-semibold text-white disabled:opacity-60 sm:w-auto"
                disabled={busy || !questionsReady}
                onClick={() => void start()}
              >
                {busy ? <Spinner size="sm" /> : "Start the game"}
              </button>
            ) : (
              <p className="text-sm font-medium text-muted">Waiting for the host to start…</p>
            )}
          </section>
        ) : null}

        {joined && question && !onLeaderboard && (snapshot.status === "QUESTION" || onPersonalResult) ? (
          <section
            key={`q-${snapshot.questionIndex}`}
            className="live-enter card space-y-5 rounded-2xl border border-line bg-surface p-5 sm:p-7"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="rounded-lg bg-forest/10 px-2.5 py-1 text-xs font-bold tracking-wide text-forest uppercase">
                Round {questionNumber} / {questionTotal}
              </p>
              {playerCount > 0 && !onPersonalResult ? (
                <AnswerMeter answered={answeredCount} total={playerCount} />
              ) : null}
            </div>
            {onPersonalResult ? null : lockedIn ? null : (
              <PhaseTimer endsAt={snapshot.endsAt} durationMs={snapshot.durationMs} />
            )}
            <h2 className="font-serif text-2xl leading-snug sm:text-3xl">{question.prompt}</h2>
            <div className="space-y-3">
              {question.options.map((option, index) => {
                const picked = selected === index;
                const isCorrect = onPersonalResult && question.correctIndex === index;
                const isWrongPick = onPersonalResult && picked && !isCorrect;
                return (
                  <button
                    key={`${question.id}-${index}`}
                    type="button"
                    disabled={!canAnswer}
                    onClick={() => void onAnswer(index)}
                    className={`live-option flex w-full items-start gap-3 rounded-2xl border px-3 py-3.5 text-left ${
                      isCorrect
                        ? "border-forest bg-forest/10"
                        : isWrongPick
                          ? "border-danger bg-danger/10"
                          : picked
                            ? `border-forest bg-forest/10 shadow-sm ${justLocked ? "live-option-picked" : ""}`
                            : "border-line hover:border-forest/50 hover:bg-parchment/50"
                    } ${canAnswer ? "cursor-pointer" : "cursor-default opacity-90"}`}
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-bold ring-1 ${
                        isCorrect
                          ? "bg-forest text-white ring-forest"
                          : isWrongPick
                            ? "bg-danger text-white ring-danger"
                            : picked
                              ? "bg-forest text-white ring-forest"
                              : "bg-parchment text-ink ring-line"
                      }`}
                    >
                      {LETTERS[index]}
                    </span>
                    <span className="pt-1.5 font-medium">{option}</span>
                  </button>
                );
              })}
            </div>
            {onPersonalResult ? (
              <RoundVerdict snapshot={snapshot} question={question} />
            ) : selected != null ? (
              <p
                className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                  questionExpired ? "bg-gold/10 text-gold" : "bg-forest/10 text-forest"
                }`}
              >
                {questionExpired
                  ? "Time’s up — tallying the scores…"
                  : snapshot.you?.answered
                    ? "Answer locked."
                    : "Answer locked — checking…"}
              </p>
            ) : (
              <p className="text-sm text-muted">Tap an answer to lock it in. Speed counts.</p>
            )}
          </section>
        ) : null}

        {onLeaderboard ? (
          <section
            key={`r-${snapshot.questionIndex}`}
            className="live-enter card space-y-5 rounded-2xl border border-line bg-surface p-5 sm:p-7"
          >
            <div className="text-center sm:text-left">
              <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase">
                Round {questionNumber} results
              </p>
              <h2 className="mt-1 font-serif text-3xl">Leaderboard</h2>
              <p className="mt-1 text-sm text-muted">
                {answeredCount} of {playerCount} answered this round
              </p>
            </div>
            {joined ? (
              <p className="text-sm font-semibold">
                {snapshot.you?.answered
                  ? snapshot.you.correct
                    ? `You got it right${snapshot.you.points ? ` · +${snapshot.you.points}` : ""}.`
                    : "You got this one wrong."
                  : snapshot.status === "REVEAL"
                    ? "You didn’t answer this round."
                    : null}
              </p>
            ) : null}
            <Scoreboard rows={snapshot.ranking} youId={snapshot.you?.id} />
            {snapshot.isHost ? (
              <button
                type="button"
                className="inline-flex w-full items-center justify-center rounded-md bg-forest px-4 py-3.5 text-base font-semibold text-white disabled:opacity-60"
                disabled={busy || snapshot.status !== "REVEAL"}
                onClick={() => void skipReveal()}
              >
                {busy ? (
                  <Spinner size="sm" />
                ) : snapshot.status !== "REVEAL" ? (
                  "Waiting for everyone…"
                ) : snapshot.hasMore ? (
                  "Next round →"
                ) : (
                  "Reveal final ranking"
                )}
              </button>
            ) : (
              <div className="rounded-2xl border-2 border-gold bg-gold/15 px-4 py-5 text-center">
                <p className="font-serif text-2xl text-ink">Waiting for the host</p>
                <p className="mt-1 text-base font-semibold text-muted">
                  They’ll start the next round when everyone’s ready.
                </p>
              </div>
            )}
          </section>
        ) : null}

        {snapshot.status === "FINISHED" ? (
          <section className="live-enter card space-y-5 rounded-2xl border border-line bg-surface p-5 sm:p-7">
            <div className="text-center">
              <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase">Game over</p>
              <h2 className="mt-1 font-serif text-3xl">Final ranking</h2>
              {snapshot.ranking[0] ? (
                <p className="mt-2 text-base font-semibold text-forest">
                  🏆 {snapshot.ranking[0].name} wins with {snapshot.ranking[0].score} points!
                </p>
              ) : null}
            </div>
            <Scoreboard rows={snapshot.ranking} youId={snapshot.you?.id} />
            <Link
              to="/"
              className="inline-flex w-full items-center justify-center rounded-md bg-forest px-4 py-3 font-semibold text-white no-underline sm:w-auto"
            >
              Back to Aether
            </Link>
          </section>
        ) : null}
      </main>
    </div>
  );
}
