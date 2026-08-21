import { useEffect, useState } from "react";
import { api, type AuditLogEntry, type Paginated } from "../api";
import { EmptyState, ErrorNote, FilterBar, FilterInput, LoadingRows, Pager, ResultCount } from "./AdminUI";

const CATEGORIES: Record<string, { label: string; stripe: string }> = {
  auth: { label: "Auth", stripe: "border-l-slate" },
  document: { label: "Upload", stripe: "border-l-gold" },
  space: { label: "Space", stripe: "border-l-clay" },
  quiz: { label: "Quiz", stripe: "border-l-forest" },
  attempt: { label: "Attempt", stripe: "border-l-forest" },
  profile: { label: "Profile", stripe: "border-l-slate" },
  user: { label: "User", stripe: "border-l-danger" },
};

const VERBS: Record<string, string> = {
  create: "created",
  update: "updated",
  delete: "deleted",
  generate: "generated",
  attempt: "attempted",
  suspend: "suspended",
  reactivate: "reactivated",
};

function describeAction(action: string) {
  const parts = action.split(".");
  const group = parts[0] === "admin" ? (parts[1] ?? "admin") : parts[0];
  const rawVerb = parts[0] === "admin" ? (parts[2] ?? "") : (parts[1] ?? "");
  const failed = rawVerb.endsWith("_failed");
  const verb = rawVerb.replace(/_failed$/, "");
  if (group === "auth") {
    if (verb === "login") return "Signed in";
    if (verb === "logout") return "Signed out";
  }
  const noun = CATEGORIES[group]?.label ?? group.charAt(0).toUpperCase() + group.slice(1);
  if (failed) {
    const failures: Record<string, string> = {
      create: "creation failed",
      update: "update failed",
      delete: "deletion failed",
      generate: "generation failed",
      attempt: "attempt failed",
      suspend: "suspension failed",
      reactivate: "reactivation failed",
    };
    return `${noun} ${failures[verb] ?? `${verb} failed`}`.trim();
  }
  return `${noun} ${VERBS[verb] ?? verb}`.trim();
}

function relativeTime(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

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
      <FilterBar
        submitLabel="Filter"
        onSubmit={() => {
          setPage(1);
          setSearch({ q: q.trim(), action: action.trim(), entityType: entityType.trim() });
        }}
      >
        <FilterInput
          className="min-w-[240px] sm:flex-[2]"
          placeholder="Search actor, action, or entity id"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <FilterInput placeholder="Action filter" value={action} onChange={(e) => setAction(e.target.value)} />
        <FilterInput placeholder="Entity type" value={entityType} onChange={(e) => setEntityType(e.target.value)} />
      </FilterBar>

      {error ? <ErrorNote message={error} /> : null}

      {loading ? <LoadingRows rows={4} /> : null}

      {!loading && data && data.items.length === 0 ? (
        <EmptyState
          title="No activity found"
          description="No audit entries matched those filters. Clear a field to widen the search."
        />
      ) : null}

      {!loading && data && data.items.length > 0 ? (
        <>
          <ResultCount total={data.total} unit="event" />
          <div className="grid gap-2.5">
            {data.items.map((entry) => {
              const actionParts = entry.action.split(".");
              const category = CATEGORIES[actionParts[0] === "admin" ? actionParts[1] : actionParts[0]];
              const failed = entry.action.endsWith("_failed");
              const errorMessage =
                failed && typeof entry.metadata.errorMessage === "string" ? entry.metadata.errorMessage : null;
              const hasMetadata = Object.keys(entry.metadata).length > 0;
              return (
                <article
                  key={entry.id}
                  className={`rounded-2xl border border-l-4 border-line bg-surface px-4 py-3.5 ${
                    failed ? "border-l-danger" : (category?.stripe ?? "border-l-slate")
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <p className="font-bold tracking-[-0.02em] text-ink">{describeAction(entry.action)}</p>
                    <p className="text-xs font-medium text-muted" title={new Date(entry.createdAt).toLocaleString()}>
                      {relativeTime(entry.createdAt)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">
                    {entry.actorName || "Unknown"}
                    {entry.actorEmail ? ` · ${entry.actorEmail}` : ""}
                  </p>
                  {errorMessage ? (
                    <p className="mt-2.5 rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
                      {errorMessage}
                    </p>
                  ) : null}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span className="rounded-md bg-parchment px-2 py-1 font-mono">{entry.action}</span>
                    <span className="rounded-md bg-parchment px-2 py-1 font-semibold">{entry.entityType}</span>
                    {entry.entityId ? (
                      <span className="max-w-full truncate rounded-md bg-parchment px-2 py-1 font-mono">
                        {entry.entityId}
                      </span>
                    ) : null}
                    {entry.ip ? <span className="rounded-md bg-parchment px-2 py-1 font-mono">{entry.ip}</span> : null}
                  </div>
                  {hasMetadata ? (
                    <details className="group mt-2.5">
                      <summary className="cursor-pointer text-xs font-semibold text-forest marker:content-none">
                        <span className="group-open:hidden">Show details</span>
                        <span className="hidden group-open:inline">Hide details</span>
                      </summary>
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-parchment px-3 py-2.5 text-xs leading-5 text-muted">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    </details>
                  ) : null}
                </article>
              );
            })}
          </div>
        </>
      ) : null}

      {data ? (
        <Pager page={data.page} totalPages={data.totalPages} total={data.total} unit="event" onChange={setPage} />
      ) : null}
    </div>
  );
}
