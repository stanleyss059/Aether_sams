import { type FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ACCENTS, accentOf } from "./accents";
import { api, ApiError, type Accent, type SpaceDetail, type SpaceSummary } from "./api";
import { uploadDocument } from "./upload";
import { ConfirmModal } from "./ConfirmModal";
import { FileBadge, SaveDocumentButton, ViewNoteButton } from "./FileBadge";

type PendingDelete =
  | { kind: "space" }
  | { kind: "document"; id: string; title: string };

export function SpacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [description, setDescription] = useState("");
  const [accent, setAccent] = useState<Accent>("forest");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [notingId, setNotingId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDelete | null>(null);

  async function load() {
    if (!id) return null;
    const next = await api<SpaceDetail>(`/api/spaces/${id}`);
    setSpace(next);
    setTitle(next.title);
    setCourseCode(next.courseCode);
    setDescription(next.description);
    setAccent(accentOf(next.accent));
    return next;
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [id]);

  function openEdit() {
    if (!space) return;
    setTitle(space.title);
    setCourseCode(space.courseCode);
    setDescription(space.description);
    setAccent(accentOf(space.accent));
    setEditing(true);
    setError("");
    setMessage("");
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const updated = await api<SpaceSummary>(`/api/spaces/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ title, courseCode, description, accent }),
      });
      setSpace((current) =>
        current
          ? {
              ...current,
              title: updated.title,
              courseCode: updated.courseCode,
              description: updated.description,
              accent: updated.accent,
            }
          : current,
      );
      setEditing(false);
      setMessage("Space updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update this space.");
    } finally {
      setBusy(false);
    }
  }

  async function onPickFile(file: File | undefined) {
    if (!file || !id) return;
    setBusy(true);
    setError("");
    try {
      const created = await uploadDocument({ file, spaceId: id });
      await load();
      void waitForNotes(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function waitForNotes(docId: string) {
    setNotingId(docId);
    try {
      for (let attempt = 0; attempt < 24; attempt += 1) {
        const next = await load();
        const doc = next?.documents.find((item) => item.id === docId);
        if (doc?.summary?.trim()) return;
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
      setMessage("File uploaded. Notes are still finishing — click View note in a moment.");
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "File uploaded. Click View note if notes are not ready yet.");
    } finally {
      setNotingId(null);
    }
  }

  async function generateNotes(docId: string, openAfter = false) {
    setNotingId(docId);
    setError("");
    try {
      const data = await api<{ id: string; summary: string }>(`/api/documents/${docId}/notes`, {
        method: "POST",
      });
      setSpace((current) =>
        current
          ? {
              ...current,
              documents: current.documents.map((doc) =>
                doc.id === docId ? { ...doc, summary: data.summary } : doc,
              ),
            }
          : current,
      );
      if (openAfter) navigate(`/documents/${docId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate notes from that upload.");
    } finally {
      setNotingId(null);
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
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${look.chip}`}>
            {space.courseCode || "SPACE"}
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em]">{space.title}</h1>
          {space.description ? <p className="mt-1 text-muted">{space.description}</p> : null}
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
            className="rounded-lg bg-forest px-4 py-2.5 font-semibold text-white disabled:opacity-60"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy && !editing ? "Uploading…" : "Upload"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-60"
            onClick={() => (editing ? setEditing(false) : openEdit())}
            disabled={busy}
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-danger/30 px-4 py-2.5 text-sm font-semibold text-danger"
            onClick={() => setPending({ kind: "space" })}
            disabled={busy}
          >
            Delete
          </button>
        </div>
      </div>

      {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {message ? <p className="rounded-md bg-forest/10 px-3 py-2 text-sm text-forest">{message}</p> : null}

      {editing ? (
        <form className="rounded-2xl border border-line bg-white p-5" onSubmit={saveEdit}>
          <h2 className="text-xl font-bold tracking-[-0.03em]">Edit space</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Space name
              <input
                className="mt-1 w-full rounded-md border border-line px-3 py-2.5"
                required
                minLength={1}
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              Course code
              <input
                className="mt-1 w-full rounded-md border border-line px-3 py-2.5"
                maxLength={32}
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
              />
            </label>
          </div>
          <label className="mt-3 block text-sm font-semibold">
            Description
            <input
              className="mt-1 w-full rounded-md border border-line px-3 py-2.5"
              maxLength={280}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(ACCENTS) as Accent[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setAccent(key)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                  accent === key ? "border-forest bg-forest/5 text-forest" : "border-line bg-white text-ink"
                }`}
              >
                <span className={`h-3 w-3 rounded-full ${ACCENTS[key].bar}`} />
                {ACCENTS[key].name}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="rounded-lg bg-forest px-4 py-2.5 font-semibold text-white" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              className="rounded-lg border border-line px-4 py-2.5 text-sm font-semibold text-ink"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <section>
        <h2 className="text-xl font-bold tracking-[-0.03em]">Uploaded materials</h2>
        {space.documents.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-line bg-white/60 px-4 py-10 text-center text-muted">
            Nothing in this space yet. Click Upload to add a PDF, Word file, or notes.
          </p>
        ) : (
          <div className="mt-3 grid gap-3">
            {space.documents.map((doc) => (
              <article
                key={doc.id}
                className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-forest/30 sm:flex-row sm:items-center sm:gap-5"
              >
                <Link to={`/documents/${doc.id}`} className="flex min-w-0 flex-1 items-start gap-4 no-underline">
                  <FileBadge filename={doc.filename} />
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-ink">{doc.title}</p>
                    <p className="mt-0.5 truncate text-sm text-muted">{doc.filename}</p>
                    <span
                      className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        doc.quizCount > 0 ? "bg-forest/10 text-forest" : "bg-slate/10 text-slate"
                      }`}
                    >
                      {doc.quizCount} quiz{doc.quizCount === 1 ? "" : "zes"}
                    </span>
                  </div>
                </Link>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {doc.latestQuizId ? (
                    <Link
                      to={`/quizzes/${doc.latestQuizId}`}
                      className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white no-underline"
                    >
                      Attempt quiz
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-lg border border-forest/40 px-4 py-2 text-sm font-semibold text-forest hover:bg-forest/5 disabled:opacity-60"
                    disabled={busy || generatingId !== null}
                    onClick={() => generateQuiz(doc.id)}
                  >
                    {generatingId === doc.id
                      ? "Generating…"
                      : doc.latestQuizId
                        ? "New quiz"
                        : "Generate quiz"}
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
                    disabled={busy || generatingId !== null}
                    onClick={() => setPending({ kind: "document", id: doc.id, title: doc.title })}
                  >
                    Remove
                  </button>
                </div>
              </article>
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
