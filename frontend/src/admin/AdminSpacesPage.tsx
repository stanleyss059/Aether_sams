import { useEffect, useState } from "react";
import { api, ApiError, type AdminSpace, type Paginated } from "../api";
import { ConfirmModal } from "../ConfirmModal";

export function AdminSpacesPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AdminSpace> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<AdminSpace | null>(null);

  async function load(nextPage = page, nextSearch = search) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: "20",
        q: nextSearch,
      });
      setData(await api<Paginated<AdminSpace>>(`/api/admin/spaces?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load spaces.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [page, search]);

  async function confirmDelete() {
    if (!pending) return;
    setBusyId(pending.id);
    setError("");
    try {
      await api(`/api/admin/spaces/${pending.id}`, { method: "DELETE" });
      setPending(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that space.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(q.trim());
        }}
      >
        <input
          className="min-w-[220px] flex-1 rounded-md border border-line px-3 py-2.5"
          placeholder="Search title, course code, or owner"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="rounded-md bg-forest px-4 py-2.5 font-semibold text-white">
          Search
        </button>
      </form>

      {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-muted">Loading spaces…</p> : null}

      {!loading && data && data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-8 text-center text-muted">
          No spaces matched that search.
        </p>
      ) : null}

      <div className="grid gap-3">
        {data?.items.map((space) => (
          <div
            key={space.id}
            className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              {space.courseCode ? (
                <span className="rounded-full bg-parchment px-2 py-0.5 text-xs font-semibold text-muted">
                  {space.courseCode}
                </span>
              ) : null}
              <p className="mt-1 font-serif text-xl text-ink">{space.title}</p>
              <p className="text-sm text-muted">
                {space.documentCount} material{space.documentCount === 1 ? "" : "s"} · {space.quizCount} quiz
                {space.quizCount === 1 ? "" : "zes"}
              </p>
              <p className="mt-1 text-sm text-muted">
                Owner: {space.owner.name} ({space.owner.email})
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md border border-danger/30 px-3 py-2 text-sm font-semibold text-danger disabled:opacity-60"
              disabled={busyId === space.id}
              onClick={() => setPending(space)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            className="rounded-md border border-line px-3 py-2 text-sm font-semibold disabled:opacity-50"
            disabled={data.page <= 1}
            onClick={() => setPage(data.page - 1)}
          >
            Previous
          </button>
          <p className="text-sm text-muted">
            Page {data.page} of {data.totalPages}
          </p>
          <button
            type="button"
            className="rounded-md border border-line px-3 py-2 text-sm font-semibold disabled:opacity-50"
            disabled={data.page >= data.totalPages}
            onClick={() => setPage(data.page + 1)}
          >
            Next
          </button>
        </div>
      ) : null}

      <ConfirmModal
        open={Boolean(pending)}
        title={`Delete “${pending?.title ?? ""}”?`}
        description="The space will be removed. Uploads in it stay with the owner as unfiled materials."
        confirmLabel="Delete space"
        busy={Boolean(pending && busyId === pending.id)}
        onCancel={() => {
          if (!busyId) setPending(null);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
