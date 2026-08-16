import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ACCENTS, accentOf } from "./accents";
import { api, ApiError, type SpaceDetail } from "./api";
import { ConfirmModal } from "./ConfirmModal";
import { prepareUpload } from "./prepareUpload";

type PendingDelete =
  | { kind: "space" }
  | { kind: "document"; id: string; title: string };

export function SpacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDelete | null>(null);

  async function load() {
    if (!id) return;
    setSpace(await api<SpaceDetail>(`/api/spaces/${id}`));
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [id]);

  async function onPickFile(file: File | undefined) {
    if (!file || !id) return;
    setBusy(true);
    setError("");
    try {
      const prepared = await prepareUpload(file);
      const body = new FormData();
      body.append("file", prepared.file, prepared.file.name);
      body.append("spaceId", id);
      body.append("title", file.name.replace(/\.[^.]+$/, "") || file.name);
      if (prepared.compressed) body.append("compressed", "gzip");
      if (prepared.reducedToText) body.append("displayFilename", file.name);
      await api("/api/documents", { method: "POST", body });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function generateQuiz(docId: string) {
    setGeneratingId(docId);
    setError("");
    try {
      const data = await api<{ quizId: string }>(`/api/documents/${docId}/generate`, {
        method: "POST",
        body: JSON.stringify({ count: 50 }),
      });
      navigate(`/quizzes/${data.quizId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate a quiz from that upload.");
      setGeneratingId(null);
    }
  }

  async function confirmPending() {
    if (!pending || !id || !space) return;
    setBusy(true);
    setError("");
    try {
      if (pending.kind === "space") {
        await api(`/api/spaces/${id}`, { method: "DELETE" });
        navigate("/spaces");
        return;
      }
      await api(`/api/documents/${pending.id}`, { method: "DELETE" });
      setPending(null);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : pending.kind === "space"
            ? "Could not delete this space."
            : "Could not delete that upload.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!space && !error) return <p className="text-muted">Loading space…</p>;
  if (!space) return <p className="text-danger">{error}</p>;

  const look = ACCENTS[accentOf(space.accent)];
  const modalTitle =
    pending?.kind === "space"
      ? `Delete “${space.title}”?`
      : pending?.kind === "document"
        ? `Delete “${pending.title}”?`
        : "";
  const modalDescription =
    pending?.kind === "space"
      ? "The space will be removed. Your uploaded materials stay in My uploads."
      : "This permanently removes the upload and any quizzes generated from it.";

  return (
    <div className="space-y-6">
      <Link to="/spaces" className="text-sm text-muted no-underline hover:text-forest">
        ← All spaces
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {space.courseCode ? (
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${look.chip}`}>{space.courseCode}</span>
          ) : (
            <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Space</p>
          )}
          <h1 className="mt-1 font-serif text-3xl">{space.title}</h1>
          {space.description ? <p className="text-muted">{space.description}</p> : null}
          <p className="mt-1 text-sm text-muted">
            {space.documentCount} material{space.documentCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            className="hidden"
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />
          <button
            type="button"
            className="rounded-md bg-forest px-4 py-2.5 font-semibold text-white disabled:opacity-60"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? "Preparing upload…" : "Upload"}
          </button>
          <button
            type="button"
            className="rounded-md border border-danger/30 px-3 py-2.5 text-sm font-semibold text-danger"
            onClick={() => setPending({ kind: "space" })}
            disabled={busy}
          >
            Delete
          </button>
        </div>
      </div>

      {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <section>
        <h2 className="font-serif text-xl">Uploaded materials</h2>
        {space.documents.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line bg-white/60 px-4 py-10 text-center text-muted">
            Nothing in this space yet. Click Upload to add a PDF, Word file, or notes.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {space.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4 transition hover:border-forest/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <Link to={`/documents/${doc.id}`} className="min-w-0 flex-1 no-underline">
                  <p className="font-serif text-xl text-ink">{doc.title}</p>
                  <p className="text-sm text-muted">
                    {doc.filename} · {doc.quizCount} quiz{doc.quizCount === 1 ? "" : "zes"}
                  </p>
                </Link>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {doc.latestQuizId ? (
                    <Link
                      to={`/quizzes/${doc.latestQuizId}`}
                      className="rounded-md bg-forest px-3 py-2 text-sm font-semibold text-white no-underline"
                    >
                      Attempt quiz
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-md border border-forest px-3 py-2 text-sm font-semibold text-forest hover:bg-forest/5 disabled:opacity-60"
                    disabled={busy || generatingId !== null}
                    onClick={() => generateQuiz(doc.id)}
                  >
                    {generatingId === doc.id
                      ? "Generating…"
                      : doc.latestQuizId
                        ? "New quiz"
                        : "Generate quiz"}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-danger/30 px-3 py-2 text-sm font-semibold text-danger disabled:opacity-60"
                    disabled={busy || generatingId !== null}
                    onClick={() => setPending({ kind: "document", id: doc.id, title: doc.title })}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(pending)}
        title={modalTitle}
        description={modalDescription}
        confirmLabel={pending?.kind === "space" ? "Delete space" : "Delete upload"}
        busy={busy && Boolean(pending)}
        onCancel={() => {
          if (!busy) setPending(null);
        }}
        onConfirm={confirmPending}
      />
    </div>
  );
}
