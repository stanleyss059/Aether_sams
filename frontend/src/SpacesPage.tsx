import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ACCENTS, accentOf } from "./accents";
import { api, ApiError, type Accent, type LibraryData, type SpaceSummary } from "./api";

export function SpacesPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<LibraryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [description, setDescription] = useState("");
  const [accent, setAccent] = useState<Accent>("forest");

  useEffect(() => {
    api<LibraryData>("/api/spaces")
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const space = await api<SpaceSummary>("/api/spaces", {
        method: "POST",
        body: JSON.stringify({ title, courseCode, description, accent }),
      });
      navigate(`/spaces/${space.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create that space.");
    } finally {
      setBusy(false);
    }
  }

  const spaces = data?.spaces ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Library</p>
          <h1 className="font-serif text-3xl">Spaces</h1>
          <p className="text-muted">Open a course deck to see its materials.</p>
        </div>
        <button
          type="button"
          className="rounded-md bg-forest px-4 py-2.5 font-semibold text-white"
          onClick={() => setCreating((open) => !open)}
        >
          {creating ? "Cancel" : "New space"}
        </button>
      </div>

      {creating ? (
        <form className="rounded-2xl border border-line bg-white p-5 shadow-sm" onSubmit={onCreate}>
          {error ? <p className="mb-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Space name
              <input
                className="mt-1 w-full rounded-md border border-line px-3 py-2.5"
                placeholder="Computer Architecture"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="block text-sm font-semibold">
              Course code
              <input
                className="mt-1 w-full rounded-md border border-line px-3 py-2.5"
                placeholder="CSM 352"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
              />
            </label>
          </div>
          <label className="mt-3 block text-sm font-semibold">
            Description
            <input
              className="mt-1 w-full rounded-md border border-line px-3 py-2.5"
              placeholder="Optional"
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
                  accent === key ? "border-ink bg-parchment" : "border-line bg-white"
                }`}
              >
                <span className={`h-3 w-3 rounded-full ${ACCENTS[key].bar}`} />
                {ACCENTS[key].name}
              </button>
            ))}
          </div>
          <button className="mt-4 rounded-md bg-forest px-4 py-2.5 font-semibold text-white" disabled={busy}>
            {busy ? "Creating…" : "Create space"}
          </button>
        </form>
      ) : error ? (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      ) : null}

      {loading ? <p className="text-muted">Loading spaces…</p> : null}
      {!loading && spaces.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-10 text-center text-muted">
          No spaces yet. Click New space to add a course deck.
        </p>
      ) : (
        <div className="grid gap-3">
          {spaces.map((space) => {
            const look = ACCENTS[accentOf(space.accent)];
            return (
              <Link
                key={space.id}
                to={`/spaces/${space.id}`}
                className="flex overflow-hidden rounded-2xl border border-line bg-white no-underline shadow-sm transition hover:border-forest/40"
              >
                <div className={`w-1.5 shrink-0 ${look.bar}`} />
                <div className="flex min-w-0 flex-1 items-center justify-between gap-4 p-4 sm:p-5">
                  <div className="min-w-0">
                    {space.courseCode ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${look.chip}`}>{space.courseCode}</span>
                    ) : null}
                    <p className="mt-1 font-serif text-2xl text-ink">{space.title}</p>
                    {space.description ? <p className="mt-1 truncate text-sm text-muted">{space.description}</p> : null}
                  </div>
                  <p className="shrink-0 text-sm text-muted">
                    {space.documentCount} material{space.documentCount === 1 ? "" : "s"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
