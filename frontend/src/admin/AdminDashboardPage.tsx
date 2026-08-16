import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AdminDashboard, type AuditLogEntry } from "../api";

export function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AdminDashboard>("/api/admin/dashboard")
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted">Loading dashboard…</p>;
  if (error) return <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>;
  if (!data) return null;

  const { stats, recentActivity } = data;

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Users" value={stats.users} to="/admin/users" />
        <Stat label="Suspended" value={stats.suspended} to="/admin/users" />
        <Stat label="Spaces" value={stats.spaces} to="/admin/spaces" />
        <Stat label="Uploads" value={stats.documents} to="/admin/uploads" />
        <Stat label="Quizzes" value={stats.quizzes} to="/admin/uploads" />
        <Stat label="Attempts" value={stats.attempts} to="/admin/audit-logs" />
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-serif text-xl">Recent activity</h2>
          <Link to="/admin/audit-logs" className="text-sm font-semibold text-forest">
            View audit logs
          </Link>
        </div>
        {recentActivity.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-8 text-center text-muted">
            No activity recorded yet.
          </p>
        ) : (
          <div className="grid gap-2">
            {recentActivity.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="rounded-2xl border border-line bg-white p-5 no-underline shadow-sm">
      <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">{label}</p>
      <p className="mt-2 font-serif text-4xl text-forest">{value}</p>
    </Link>
  );
}

function ActivityRow({ entry }: { entry: AuditLogEntry }) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-ink">{entry.action}</p>
        <p className="text-xs text-muted">{new Date(entry.createdAt).toLocaleString()}</p>
      </div>
      <p className="mt-1 text-sm text-muted">
        {entry.actorName || entry.actorEmail || "System"} · {entry.entityType}
        {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}…` : ""}
      </p>
    </div>
  );
}
