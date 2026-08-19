import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "./api";
import { LoadingState, Spinner } from "./Spinner";

const LETTERS = ["A", "B", "C", "D"] as const;

type Draft = { answers: Record<string, number>; index: number };

function draftKey(quizId: string) {
  return `aether.quiz-draft.${quizId}`;
}

function readDraft(quizId: string): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey(quizId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    if (!parsed || typeof parsed.answers !== "object" || parsed.answers == null) return null;
    return { answers: parsed.answers, index: Number(parsed.index) || 0 };
  } catch {
    return null;
  }
}

function writeDraft(quizId: string, draft: Draft) {
  localStorage.setItem(draftKey(quizId), JSON.stringify(draft));
}

function clearDraft(quizId: string) {
  localStorage.removeItem(draftKey(quizId));
}

type Quiz = {
  title: string;
  documentId: string;
  documentTitle: string;
  questions: Array<{ id: string; prompt: string; options: string[] }>;
};

type ReviewItem = {
  id: string;
  prompt: string;
  options: string[];
  selectedIndex: number | null;
  correctIndex: number;
  explanation: string;
  correct: boolean;
};

type Result = {
  score: number;
  total: number;
  review: ReviewItem[];
};

type Filter = "all" | "missed" | "correct";

export function QuizPage() {
  const { id } = useParams();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => {
    if (!id) return;
    api<Quiz>(`/api/quizzes/${id}`)
      .then((data) => {
        const draft = readDraft(id);
        const ids = new Set(data.questions.map((q) => q.id));
        const restored: Record<string, number> = {};
        if (draft) {
          for (const [questionId, choice] of Object.entries(draft.answers)) {
            if (ids.has(questionId) && Number.isInteger(choice) && choice >= 0 && choice <= 3) {
              restored[questionId] = choice;
            }
          }
        }
        setQuiz(data);
        setAnswers(restored);
        setIndex(Math.min(Math.max(0, draft?.index ?? 0), Math.max(0, data.questions.length - 1)));
        setResult(null);
      })
      .catch((err: Error) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!id || !quiz || result) return;
    writeDraft(id, { answers, index });
  }, [id, quiz, answers, index, result]);

  const question = quiz?.questions[index];
  const answeredCount = quiz ? quiz.questions.filter((q) => answers[q.id] !== undefined).length : 0;
  const remaining = quiz ? quiz.questions.length - answeredCount : 0;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!quiz || result || !question) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min(quiz.questions.length - 1, i + 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else {
        const letter = LETTERS.indexOf(e.key.toUpperCase() as (typeof LETTERS)[number]);
        const numeric = Number(e.key) - 1;
        const choice = letter >= 0 ? letter : numeric;
        if (choice >= 0 && choice < question.options.length) {
          setAnswers((prev) => ({ ...prev, [question.id]: choice }));
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quiz, result, question]);

  async function submit() {
    if (!quiz) return;
    if (remaining > 0 && !confirmSubmit) {
      setConfirmSubmit(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await api<Result>(`/api/quizzes/${id}/attempt`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      setResult(data);
      setConfirmSubmit(false);
      if (id) clearDraft(id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !quiz) return <p className="text-danger">{error}</p>;
  if (!quiz || !question) return <LoadingState />;

  if (result) {
    return (
      <ResultsView
        quiz={quiz}
        result={result}
        onRetake={() => {
          if (id) clearDraft(id);
          setResult(null);
          setAnswers({});
          setIndex(0);
          setConfirmSubmit(false);
        }}
      />
    );
  }

  const progress = Math.round((answeredCount / quiz.questions.length) * 100);
  const selected = answers[question.id];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to={`/documents/${quiz.documentId}`} className="text-sm text-muted no-underline hover:text-forest">
            ← {quiz.documentTitle}
          </Link>
          <h1 className="mt-1 font-serif text-3xl">{quiz.title}</h1>
        </div>
        <p className="rounded-full border border-line bg-white px-3 py-1 text-sm text-muted">
          {answeredCount} of {quiz.questions.length} answered
        </p>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs font-semibold tracking-wide text-muted uppercase">
          <span>Question {index + 1}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white ring-1 ring-line">
          <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7">
          <p className="font-serif text-5xl leading-none text-gold">{index + 1}</p>
          <h2 className="mt-4 font-serif text-2xl leading-snug">{question.prompt}</h2>
          <div className="mt-6 space-y-3">
            {question.options.map((opt, i) => {
              const active = selected === i;
              return (
                <button
                  key={`${question.id}-${i}`}
                  type="button"
                  onClick={() => {
                    setAnswers((prev) => ({ ...prev, [question.id]: i }));
                    setConfirmSubmit(false);
                  }}
                  className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-forest bg-forest/10 ring-2 ring-forest"
                      : "border-line bg-parchment/40 hover:border-forest/40 hover:bg-white"
                  }`}
                >
                  <span
                    className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md text-sm font-bold ${
                      active ? "bg-forest text-white" : "bg-white text-forest ring-1 ring-line"
                    }`}
                  >
                    {LETTERS[i]}
                  </span>
                  <span className="pt-1 leading-relaxed">{opt}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              className="rounded-md border border-line px-4 py-2.5 font-semibold disabled:opacity-40"
              disabled={index === 0}
              onClick={() => setIndex((i) => i - 1)}
            >
              Previous
            </button>
            {index < quiz.questions.length - 1 ? (
              <button
                type="button"
                className="rounded-md bg-forest px-5 py-2.5 font-semibold text-white"
                onClick={() => setIndex((i) => i + 1)}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md bg-gold px-5 py-2.5 font-semibold text-forest"
                disabled={busy}
                onClick={submit}
              >
                {busy ? <Spinner size="sm" className="text-forest" /> : "Submit quiz"}
              </button>
            )}
          </div>
          <p className="mt-4 text-xs text-muted">Use A–D or 1–4 to choose. Arrow keys move between questions.</p>
        </section>

        <aside className="rounded-2xl border border-line bg-white p-4">
          <p className="mb-3 text-xs font-semibold tracking-[0.18em] text-muted uppercase">Jump to</p>
          <div className="grid grid-cols-10 gap-1.5 lg:grid-cols-5">
            {quiz.questions.map((q, i) => {
              const filled = answers[q.id] !== undefined;
              const current = i === index;
              return (
                <button
                  key={q.id}
                  type="button"
                  title={`Question ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-8 rounded-md text-xs font-semibold ${
                    current
                      ? "bg-gold text-forest"
                      : filled
                        ? "bg-forest text-white"
                        : "bg-parchment text-muted ring-1 ring-line"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="mt-4 space-y-1 text-xs text-muted">
            <p>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-gold align-middle" /> Current
            </p>
            <p>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-forest align-middle" /> Answered
            </p>
            <p>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-parchment ring-1 ring-line align-middle" />{" "}
              Unanswered
            </p>
          </div>
          <button
            type="button"
            className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-forest px-4 py-2.5 font-semibold text-white disabled:opacity-60"
            disabled={busy}
            onClick={submit}
          >
            {busy ? <Spinner size="sm" /> : "Submit quiz"}
          </button>
          {confirmSubmit && remaining > 0 ? (
            <p className="mt-3 rounded-md bg-gold/20 px-3 py-2 text-sm">
              {remaining} unanswered. Submit anyway, or keep going — click Submit again to confirm.
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function ResultsView({
  quiz,
  result,
  onRetake,
}: {
  quiz: Quiz;
  result: Result;
  onRetake: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const percent = Math.round((result.score / result.total) * 100);
  const missed = result.review.filter((item) => !item.correct).length;
  const tone = percent >= 80 ? "text-forest" : percent >= 50 ? "text-gold" : "text-danger";

  const items = useMemo(() => {
    if (filter === "missed") return result.review.filter((item) => !item.correct);
    if (filter === "correct") return result.review.filter((item) => item.correct);
    return result.review;
  }, [filter, result.review]);

  return (
    <div className="space-y-6">
      <Link to={`/documents/${quiz.documentId}`} className="text-sm text-muted no-underline hover:text-forest">
        ← {quiz.documentTitle}
      </Link>

      <section className="grid gap-5 rounded-2xl border border-line bg-white p-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <ScoreRing percent={percent} tone={tone} />
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Results</p>
          <h1 className="font-serif text-3xl sm:text-4xl">
            {result.score} / {result.total} correct
          </h1>
          <p className="mt-1 text-muted">
            {percent}% on {quiz.title}. {missed === 0 ? "Every answer was right." : `${missed} to review.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="rounded-md bg-forest px-4 py-2 font-semibold text-white" onClick={onRetake}>
              Retake quiz
            </button>
            <Link to="/" className="rounded-md border border-line px-4 py-2 font-semibold no-underline">
              Back to dashboard
            </Link>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", `All (${result.total})`],
            ["missed", `Missed (${missed})`],
            ["correct", `Correct (${result.score})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
              filter === id ? "bg-forest text-white" : "border border-line bg-white text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {items.map((item) => {
          const originalIndex = result.review.findIndex((row) => row.id === item.id);
          return (
            <article
              key={item.id}
              className={`rounded-2xl border bg-white p-5 ${
                item.correct ? "border-forest/30" : "border-danger/30"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-serif text-lg text-muted">{originalIndex + 1}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    item.correct ? "bg-forest/10 text-forest" : "bg-danger/10 text-danger"
                  }`}
                >
                  {item.correct ? "Correct" : item.selectedIndex == null ? "Skipped" : "Incorrect"}
                </span>
              </div>
              <h2 className="mt-2 font-serif text-xl leading-snug">{item.prompt}</h2>
              <ul className="mt-4 space-y-2">
                {item.options.map((opt, i) => {
                  const isCorrect = i === item.correctIndex;
                  const isPicked = i === item.selectedIndex;
                  return (
                    <li
                      key={`${item.id}-${i}`}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                        isCorrect
                          ? "border-forest bg-forest/10 font-semibold text-forest"
                          : isPicked
                            ? "border-danger bg-danger/10 text-danger"
                            : "border-transparent text-muted"
                      }`}
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white text-xs ring-1 ring-line">
                        {LETTERS[i]}
                      </span>
                      <span>
                        {opt}
                        {isCorrect ? " · correct" : ""}
                        {isPicked && !isCorrect ? " · your answer" : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {item.explanation ? <p className="mt-3 text-sm leading-relaxed text-muted">{item.explanation}</p> : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ScoreRing({ percent, tone }: { percent: number; tone: string }) {
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (percent / 100) * circ;
  return (
    <div className={`relative grid h-28 w-28 place-items-center ${tone}`}>
      <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#ddd4c4" strokeWidth="8" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute font-serif text-2xl text-ink">{percent}%</span>
    </div>
  );
}
