import { useEffect, useState } from "react";
import { ACCENTS, accentOf } from "../accents";
import { api, ApiError, type AdminSpace, type Paginated } from "../api";
import { ConfirmModal } from "../ConfirmModal";
import {
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
      <FilterBar
        onSubmit={() => {
          setPage(1);
          setSearch(q.trim());
        }}
      >
        <FilterInput
          placeholder="Search title, course code, or owner"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </FilterBar>

      {error ? <ErrorNote message={error} /> : null}

      {loading ? <LoadingRows /> : null}

      {!loading && data && data.items.length === 0 ? (
        <EmptyState
          title="No spaces found"
          description="No course space matched that search. Try a course code or owner email."
        />
      ) : null}

      {!loading && data && data.items.length > 0 ? (
        <>
          <ResultCount total={data.total} unit="space" />
          <div className="grid gap-3">
            {data.items.map((space) => {
              const look = ACCENTS[accentOf(space.accent)];
              return (
                <RowCard key={space.id}>
                  <div className="flex min-w-0 items-stretch gap-3.5">
                    <span className={`w-1.5 shrink-0 rounded-full ${look.bar}`} aria-hidden="true" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-lg font-bold tracking-[-0.02em] text-ink">{space.title}</p>
                        {space.courseCode ? <Chip tone="accent">{space.courseCode}</Chip> : null}
                      </div>
                      {space.description ? (
                        <p className="mt-0.5 truncate text-sm text-muted">{space.description}</p>
                      ) : null}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        <Pill>
                          {space.documentCount} material{space.documentCount === 1 ? "" : "s"}
                        </Pill>
                        <Pill>
                          {space.quizCount} quiz{space.quizCount === 1 ? "" : "zes"}
                        </Pill>
                        <Pill>Created {new Date(space.createdAt).toLocaleDateString()}</Pill>
                        <Pill>{space.owner.name}</Pill>
                      </div>
                      <p className="mt-1.5 truncate text-xs text-muted">{space.owner.email}</p>
                    </div>
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <RowButton tone="danger" disabled={busyId === space.id} onClick={() => setPending(space)}>
                      Delete
                    </RowButton>
                  </div>
                </RowCard>
              );
            })}
          </div>
        </>
      ) : null}

      {data ? (
        <Pager page={data.page} totalPages={data.totalPages} total={data.total} unit="space" onChange={setPage} />
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
