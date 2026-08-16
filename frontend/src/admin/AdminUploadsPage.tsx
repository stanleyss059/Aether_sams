import { useEffect, useState } from "react";
import { api, ApiError, type AdminDocument, type Paginated } from "../api";
import { ConfirmModal } from "../ConfirmModal";

export function AdminUploadsPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AdminDocument> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<AdminDocument | null>(null);

  async function load(nextPage = page, nextSearch = search) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: "20",
        q: nextSearch,
      });
      setData(await api<Paginated<AdminDocument>>(`/api/admin/documents?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load uploads.");
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
      await api(`/api/admin/documents/${pending.id}`, { method: "DELETE" });
      setPending(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that upload.");
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
          placeholder="Search title, filename, or owner"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="rounded-md bg-forest px-4 py-2.5 font-semibold text-white">
          Search
        </button>
      </form>

      {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-muted">Loading uploads…</p> : null}

      {!loading && data && data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-8 text-center text-muted">
          No uploads matched that search.
        </p>
      ) : null}

      <div className="grid gap-3">
        {data?.items.map((doc) => (
          <div
            key={doc.id}
            className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="font-serif text-xl text-ink">{doc.title}</p>
              <p className="text-sm text-muted">
                {doc.filename} · {doc.quizCount} quiz{doc.quizCount === 1 ? "" : "zes"}
              </p>
              <p className="mt-1 text-sm text-muted">
                Owner: {doc.owner.name} ({doc.owner.email})
                {doc.space ? ` · Space: ${doc.space.courseCode || doc.space.title}` : " · Unfiled"}
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-md border border-danger/30 px-3 py-2 text-sm font-semibold text-danger disabled:opacity-60"
              disabled={busyId === doc.id}
              onClick={() => setPending(doc)}
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
        description="This permanently removes the upload and any quizzes generated from it."
        confirmLabel="Delete upload"
        busy={Boolean(pending && busyId === pending.id)}
        onCancel={() => {
          if (!busyId) setPending(null);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
