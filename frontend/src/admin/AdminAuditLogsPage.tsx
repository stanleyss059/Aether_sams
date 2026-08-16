import { useEffect, useState } from "react";
import { api, type AuditLogEntry, type Paginated } from "../api";

export function AdminAuditLogsPage() {
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [search, setSearch] = useState({ q: "", action: "", entityType: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AuditLogEntry> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "25",
      q: search.q,
      action: search.action,
      entityType: search.entityType,
    });
    api<Paginated<AuditLogEntry>>(`/api/admin/audit-logs?${params}`)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, search]);

  return (
    <div className="space-y-4">
      <form
        className="grid gap-2 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch({ q: q.trim(), action: action.trim(), entityType: entityType.trim() });
        }}
      >
        <input
          className="rounded-md border border-line px-3 py-2.5 sm:col-span-2"
          placeholder="Search actor, action, or entity id"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className="rounded-md border border-line px-3 py-2.5"
          placeholder="Action filter"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            className="min-w-0 flex-1 rounded-md border border-line px-3 py-2.5"
            placeholder="Entity type"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          />
          <button type="submit" className="rounded-md bg-forest px-4 py-2.5 font-semibold text-white">
            Filter
          </button>
        </div>
      </form>

      {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-muted">Loading audit logs…</p> : null}

      {!loading && data && data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-8 text-center text-muted">
          No audit entries matched those filters.
        </p>
      ) : null}

      <div className="grid gap-2">
        {data?.items.map((entry) => (
          <article key={entry.id} className="rounded-xl border border-line bg-white px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-ink">{entry.action}</p>
                <p className="text-sm text-muted">
                  {entry.actorName || "Unknown"} {entry.actorEmail ? `(${entry.actorEmail})` : ""}
                </p>
              </div>
              <p className="text-xs text-muted">{new Date(entry.createdAt).toLocaleString()}</p>
            </div>
            <p className="mt-2 text-sm text-muted">
              {entry.entityType}
              {entry.entityId ? ` · ${entry.entityId}` : ""}
              {entry.ip ? ` · ${entry.ip}` : ""}
            </p>
            {Object.keys(entry.metadata).length > 0 ? (
              <pre className="mt-2 overflow-x-auto rounded-md bg-parchment px-3 py-2 text-xs text-muted">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            ) : null}
          </article>
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
            Page {data.page} of {data.totalPages} · {data.total} events
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
    </div>
  );
}
