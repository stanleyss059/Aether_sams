import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ACCENTS, accentOf } from "./accents";
import { api, ApiError, type SpaceDetail } from "./api";

export function SpacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    const body = new FormData();
    body.append("file", file);
    body.append("spaceId", id);
    try {
      await api("/api/documents", { method: "POST", body });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeSpace() {
    if (!id || !space) return;
    const ok = window.confirm(`Remove “${space.title}”? Materials stay in My uploads.`);
    if (!ok) return;
    setBusy(true);
    try {
      await api(`/api/spaces/${id}`, { method: "DELETE" });
      navigate("/spaces");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this space.");
      setBusy(false);
    }
  }

  if (!space && !error) return <p className="text-muted">Loading space…</p>;
  if (!space) return <p className="text-danger">{error}</p>;

  const look = ACCENTS[accentOf(space.accent)];

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
            {busy ? "Uploading…" : "Upload"}
          </button>
          <button
            type="button"
            className="rounded-md border border-danger/30 px-3 py-2.5 text-sm font-semibold text-danger"
            onClick={removeSpace}
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
              <Link
                key={doc.id}
                to={`/documents/${doc.id}`}
                className="rounded-xl border border-line bg-white p-4 no-underline transition hover:border-forest/40"
              >
                <p className="font-serif text-xl text-ink">{doc.title}</p>
                <p className="text-sm text-muted">
                  {doc.filename} · {doc.quizCount} quiz{doc.quizCount === 1 ? "" : "zes"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
