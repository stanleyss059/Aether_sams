import { useEffect, useState } from "react";
import { api, ApiError, type AdminUser, type Paginated } from "../api";
import { useAuth } from "../AuthContext";
import { ConfirmModal } from "../ConfirmModal";

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<AdminUser> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);

  async function load(nextPage = page, nextSearch = search) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: "20",
        q: nextSearch,
      });
      setData(await api<Paginated<AdminUser>>(`/api/admin/users?${params}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [page, search]);

  async function suspend(user: AdminUser) {
    setBusyId(user.id);
    setError("");
    try {
      await api(`/api/admin/users/${user.id}/suspend`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not suspend that user.");
    } finally {
      setBusyId(null);
    }
  }

  async function reactivate(user: AdminUser) {
    setBusyId(user.id);
    setError("");
    try {
      await api(`/api/admin/users/${user.id}/reactivate`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reactivate that user.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    setError("");
    try {
      await api(`/api/admin/users/${pendingDelete.id}`, { method: "DELETE" });
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that user.");
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
          placeholder="Search name or email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="submit" className="rounded-md bg-forest px-4 py-2.5 font-semibold text-white">
          Search
        </button>
      </form>

      {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-muted">Loading users…</p> : null}

      {!loading && data && data.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-8 text-center text-muted">
          No users matched that search.
        </p>
      ) : null}

      <div className="grid gap-3">
        {data?.items.map((user) => {
          const isSelf = user.id === me?.id;
          const suspended = Boolean(user.suspendedAt);
          return (
            <div
              key={user.id}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-serif text-xl text-ink">{user.name}</p>
                  <span className="rounded-full bg-parchment px-2 py-0.5 text-xs font-semibold text-muted">
                    {user.role}
                  </span>
                  {suspended ? (
                    <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                      Suspended
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-muted">{user.email}</p>
                <p className="mt-1 text-sm text-muted">
                  {user.spaceCount} spaces · {user.documentCount} uploads · {user.quizCount} quizzes · joined{" "}
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {user.role !== "ADMIN" && !isSelf ? (
                  suspended ? (
                    <button
                      type="button"
                      className="rounded-md border border-forest px-3 py-2 text-sm font-semibold text-forest disabled:opacity-60"
                      disabled={busyId === user.id}
                      onClick={() => reactivate(user)}
                    >
                      Reactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="rounded-md border border-line px-3 py-2 text-sm font-semibold text-ink disabled:opacity-60"
                      disabled={busyId === user.id}
                      onClick={() => suspend(user)}
                    >
                      Suspend
                    </button>
                  )
                ) : null}
                {user.role !== "ADMIN" && !isSelf ? (
                  <button
                    type="button"
                    className="rounded-md border border-danger/30 px-3 py-2 text-sm font-semibold text-danger disabled:opacity-60"
                    disabled={busyId === user.id}
                    onClick={() => setPendingDelete(user)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {data && data.totalPages > 1 ? (
        <Pager page={data.page} totalPages={data.totalPages} onChange={setPage} />
      ) : null}

      <ConfirmModal
        open={Boolean(pendingDelete)}
        title={`Delete “${pendingDelete?.name ?? ""}”?`}
        description="This permanently removes the account and all of their spaces, uploads, quizzes, and attempts."
        confirmLabel="Delete user"
        busy={Boolean(pendingDelete && busyId === pendingDelete.id)}
        onCancel={() => {
          if (!busyId) setPendingDelete(null);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function Pager({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        className="rounded-md border border-line px-3 py-2 text-sm font-semibold disabled:opacity-50"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <p className="text-sm text-muted">
        Page {page} of {totalPages}
      </p>
      <button
        type="button"
        className="rounded-md border border-line px-3 py-2 text-sm font-semibold disabled:opacity-50"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
