import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type DocListItem } from "./api";
import { ConfirmModal } from "./ConfirmModal";
import { FileBadge } from "./FileBadge";

export function UploadsPage() {
  const [docs, setDocs] = useState<DocListItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<DocListItem | null>(null);

  useEffect(() => {
    api<DocListItem[]>("/api/documents")
      .then(setDocs)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function confirmRemove() {
    if (!pending) return;
    const doc = pending;
    setBusyId(doc.id);
    setError("");
    try {
      await api(`/api/documents/${doc.id}`, { method: "DELETE" });
      setDocs((current) => current.filter((item) => item.id !== doc.id));
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
      {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-muted">Loading uploads…</p> : null}
      {!loading && docs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-8 text-center text-muted">
          No uploads yet. <Link to="/spaces">Open a space</Link> and add lecture notes.
        </p>
      ) : (
        <div className="grid gap-3">
          {docs.map((doc) => (
            <article
              key={doc.id}
              className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-forest/30 sm:flex-row sm:items-center sm:gap-5"
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
                <Link
                  to={doc.latestQuizId ? `/quizzes/${doc.latestQuizId}` : `/documents/${doc.id}`}
                  className="rounded-lg bg-forest px-4 py-2 text-center text-sm font-semibold text-white no-underline"
                >
                  {doc.latestQuizId ? "Attempt quiz" : "Generate quiz"}
                </Link>
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
