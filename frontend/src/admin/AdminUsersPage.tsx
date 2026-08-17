import { useEffect, useState } from "react";
import { api, ApiError, type AdminUser, type Paginated } from "../api";
import { useAuth } from "../AuthContext";
import { ConfirmModal } from "../ConfirmModal";
import {
  Avatar,
  Chip,
  EmptyState,
  ErrorNote,
  FilterBar,
  FilterInput,
  LoadingRows,
  Pager,
  Pill,
  ResultCount,
  RowButton,
  RowCard,
} from "./AdminUI";

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
      <FilterBar
        onSubmit={() => {
          setPage(1);
          setSearch(q.trim());
        }}
      >
        <FilterInput placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      </FilterBar>

      {error ? <ErrorNote message={error} /> : null}

      {loading ? <LoadingRows /> : null}

      {!loading && data && data.items.length === 0 ? (
        <EmptyState title="No users found" description="No accounts matched that search. Try a different name or email." />
      ) : null}

      {!loading && data && data.items.length > 0 ? (
        <>
          <ResultCount total={data.total} unit="account" />
          <div className="grid gap-3">
            {data.items.map((user) => {
              const isSelf = user.id === me?.id;
              const suspended = Boolean(user.suspendedAt);
              const protectedAccount = user.role === "ADMIN" || isSelf;
              return (
                <RowCard key={user.id}>
                  <div className="flex min-w-0 items-start gap-3.5">
                    <Avatar name={user.name} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-lg font-bold tracking-[-0.02em] text-ink">{user.name}</p>
                        {user.role === "ADMIN" ? <Chip tone="accent">Admin</Chip> : null}
                        {suspended ? <Chip tone="danger">Suspended</Chip> : null}
                        {isSelf ? <Chip>You</Chip> : null}
                      </div>
                      <p className="truncate text-sm text-muted">{user.email}</p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <Pill>{user.spaceCount} spaces</Pill>
                        <Pill>{user.documentCount} uploads</Pill>
                        <Pill>{user.quizCount} quizzes</Pill>
                        <Pill>Joined {new Date(user.createdAt).toLocaleDateString()}</Pill>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    {protectedAccount ? (
                      <p className="text-xs text-muted">Protected account</p>
                    ) : (
                      <>
                        {suspended ? (
                          <RowButton tone="accent" disabled={busyId === user.id} onClick={() => reactivate(user)}>
                            Reactivate
                          </RowButton>
                        ) : (
                          <RowButton disabled={busyId === user.id} onClick={() => suspend(user)}>
                            Suspend
                          </RowButton>
                        )}
                        <RowButton tone="danger" disabled={busyId === user.id} onClick={() => setPendingDelete(user)}>
                          Delete
                        </RowButton>
                      </>
                    )}
                  </div>
                </RowCard>
              );
            })}
          </div>
        </>
      ) : null}

      {data ? (
        <Pager page={data.page} totalPages={data.totalPages} total={data.total} unit="account" onChange={setPage} />
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
