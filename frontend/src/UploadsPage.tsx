import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type DocListItem } from "./api";
import { ConfirmModal } from "./ConfirmModal";
import { GenerateQuizModal } from "./GenerateQuizModal";
import { FileBadge, SaveDocumentButton, ViewNoteButton } from "./FileBadge";
import { openGeneratedQuiz } from "./live";
import { useCachedGet, bumpLibrary } from "./page-cache";
import { ShareButton } from "./ShareButton";
import { LoadingState, Spinner } from "./Spinner";

export function UploadsPage() {
  const query = useCachedGet<DocListItem[]>("/api/documents");
  const docs = query.data ?? [];
  const loading = query.loading;
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notingId, setNotingId] = useState<string | null>(null);
  const [pending, setPending] = useState<DocListItem | null>(null);
  const [quizTarget, setQuizTarget] = useState<DocListItem | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const navigate = useNavigate();

  async function generateNotes(docId: string, openAfter = false) {
    setNotingId(docId);
    setError("");
    try {
      await api<{ id: string; summary: string }>(`/api/documents/${docId}/notes`, {
        method: "POST",
      });
      bumpLibrary();
      if (openAfter) navigate(`/documents/${docId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate notes from that upload.");
    } finally {
      setNotingId(null);
    }
  }

  async function generateQuiz(count: number, live = false) {
    if (!quizTarget) return;
    const docId = quizTarget.id;
    setGeneratingId(docId);
    setError("");
    try {
      const data = await api<{ quizId: string }>(`/api/documents/${docId}/generate`, {
        method: "POST",
        body: JSON.stringify({ count }),
      });
      setQuizTarget(null);
      bumpLibrary();
      await openGeneratedQuiz(navigate, data.quizId, live);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate a quiz from that upload.");
      setGeneratingId(null);
    }
  }

  async function confirmRemove() {
    if (!pending) return;
    const doc = pending;
    setBusyId(doc.id);
    setError("");
    try {
      await api(`/api/documents/${doc.id}`, { method: "DELETE" });
      bumpLibrary();
      setPending(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that upload.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="inline-flex rounded-full bg-forest/10 px-2.5 py-1 text-xs font-bold text-forest">LIBRARY</span>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em]">My uploads</h1>
        <p className="mt-1 text-muted">Every file you have uploaded, across all course spaces.</p>
      </div>
      {error || query.error ? (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error || query.error}</p>
      ) : null}
      {loading ? <LoadingState className="flex items-center justify-center py-12" /> : null}
      {!loading && docs.length === 0 ? (
        <p className="card-empty px-4 py-12 text-center text-muted">
          No uploads yet. <Link to="/spaces">Open a space</Link> and add lecture notes.
        </p>
      ) : (
        <div className="stagger grid gap-3">
          {docs.map((doc) => (
            <article
              key={doc.id}
              className="lift-card flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-5"
            >
              <Link to={`/documents/${doc.id}`} className="flex min-w-0 flex-1 items-start gap-4 no-underline">
                <FileBadge filename={doc.filename} />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-ink">{doc.title}</p>
                  <p className="mt-0.5 truncate text-sm text-muted">{doc.filename}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-slate/10 px-2 py-0.5 text-xs font-semibold text-slate">
                      {doc.space ? doc.space.courseCode || doc.space.title : "Unfiled"}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        doc.quizCount > 0 ? "bg-forest/10 text-forest" : "bg-slate/10 text-slate"
                      }`}
                    >
                      {doc.quizCount} quiz{doc.quizCount === 1 ? "" : "zes"}
                    </span>
                  </div>
                </div>
              </Link>
              <div className="flex shrink-0 flex-wrap gap-2">
                {doc.latestQuizId ? (
                  <>
                    <Link
                      to={`/quizzes/${doc.latestQuizId}`}
                      className="rounded-lg bg-forest px-4 py-2 text-center text-sm font-semibold text-white no-underline"
                    >
                      Attempt quiz
                    </Link>
                    <ShareButton
                      path={`/quizzes/${doc.latestQuizId}`}
                      className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink"
                    />
                  </>
                ) : null}
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-forest/40 px-4 py-2 text-sm font-semibold text-forest hover:bg-forest/5 disabled:opacity-60"
                  disabled={generatingId !== null}
                  onClick={() => setQuizTarget(doc)}
                >
                  {generatingId === doc.id ? (
                    <Spinner size="sm" className="text-forest" />
                  ) : doc.latestQuizId ? (
                    "New quiz"
                  ) : (
                    "Generate quiz"
                  )}
                </button>
                <ViewNoteButton
                  documentId={doc.id}
                  hasNotes={Boolean(doc.summary?.trim())}
                  generating={notingId === doc.id}
                  onGenerate={() => generateNotes(doc.id, true)}
                />
                <SaveDocumentButton documentId={doc.id} filename={doc.filename} />
                <button
                  type="button"
                  className="rounded-lg border border-danger/30 px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60"
                  disabled={busyId === doc.id}
                  onClick={() => setPending(doc)}
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <GenerateQuizModal
        open={Boolean(quizTarget)}
        title={quizTarget?.title}
        busy={Boolean(quizTarget && generatingId === quizTarget.id)}
        onCancel={() => {
          if (!generatingId) setQuizTarget(null);
        }}
        onGenerate={generateQuiz}
      />
      <ConfirmModal
        open={Boolean(pending)}
        title={`Delete “${pending?.title ?? ""}”?`}
        description="This permanently removes the upload and any quizzes generated from it."
        confirmLabel="Delete upload"
        busy={Boolean(pending && busyId === pending.id)}
        onCancel={() => {
          if (!busyId) setPending(null);
        }}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
