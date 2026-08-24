import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type QuizListItem } from "./api";
import { GenerateQuizModal } from "./GenerateQuizModal";
import { openGeneratedQuiz } from "./live";
import { ShareButton } from "./ShareButton";
import { LoadingState, Spinner } from "./Spinner";

function whenLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function QuizzesPage() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [quizzes, setQuizzes] = useState<QuizListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api<QuizListItem[]>("/api/quizzes")
      .then(setQuizzes)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function openPicker(event: FormEvent) {
    event.preventDefault();
    const next = topic.trim();
    if (next.length < 3) {
      setError("Type a topic of at least 3 characters.");
      return;
    }
    setError("");
    setPickerOpen(true);
  }

  async function generate(count: number, live = false) {
    const next = topic.trim();
    if (next.length < 3) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<{ quizId: string }>("/api/quizzes/topic", {
        method: "POST",
        body: JSON.stringify({ topic: next, count }),
      });
      setPickerOpen(false);
      await openGeneratedQuiz(navigate, data.quizId, live);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate that quiz.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-flex rounded-full bg-forest/10 px-2.5 py-1 text-xs font-bold text-forest">QUIZZES</span>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em]">Quizzes</h1>
        <p className="mt-1 text-muted">Type a topic, or reopen a quiz you already generated.</p>
      </div>

      <form className="card rounded-3xl border border-line bg-surface p-5 sm:p-6" onSubmit={openPicker}>
        <label className="block text-sm font-semibold" htmlFor="quiz-topic">
          Quiz from a topic
        </label>
        <p className="mt-1 text-sm text-muted">Aether will write multiple-choice questions about whatever you type.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            id="quiz-topic"
            className="w-full rounded-md border border-line px-3 py-2.5 sm:flex-1"
            placeholder="e.g. photosynthesis, SQL joins, French revolution"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            minLength={3}
            maxLength={120}
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-md bg-forest px-4 py-2.5 font-semibold text-white disabled:opacity-60"
            disabled={busy}
          >
            {busy ? <Spinner size="sm" /> : "Generate quiz"}
          </button>
        </div>
      </form>

      {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      {loading ? <LoadingState className="flex items-center justify-center py-12" /> : null}

      {!loading && quizzes.length === 0 ? (
        <p className="card-empty px-4 py-12 text-center text-muted">
          No quizzes yet. Generate one from a topic, or from an upload in a space.
        </p>
      ) : null}

      {!loading && quizzes.length > 0 ? (
        <div className="stagger grid gap-3">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="lift-card flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-4"
            >
              <Link to={`/quizzes/${quiz.id}`} className="min-w-0 flex-1 no-underline">
                <span className="block truncate font-semibold text-ink">{quiz.title}</span>
                <span className="mt-1 block text-sm text-muted">
                  {quiz.questionCount} question{quiz.questionCount === 1 ? "" : "s"}
                  {quiz.attemptCount > 0
                    ? ` · ${quiz.attemptCount} attempt${quiz.attemptCount === 1 ? "" : "s"}`
                    : ""}
                  {quiz.documentTitle ? ` · ${quiz.documentTitle}` : " · Topic quiz"}
                  {quiz.createdAt ? ` · ${whenLabel(quiz.createdAt)}` : ""}
                </span>
              </Link>
              <ShareButton path={`/quizzes/${quiz.id}`} />
              <Link to={`/quizzes/${quiz.id}`} className="shrink-0 font-semibold text-forest no-underline">
                Open →
              </Link>
            </div>
          ))}
        </div>
      ) : null}

      <GenerateQuizModal
        open={pickerOpen}
        title={topic.trim()}
        fromTopic
        busy={busy}
        onCancel={() => {
          if (!busy) setPickerOpen(false);
        }}
        onGenerate={generate}
      />
    </div>
  );
}
