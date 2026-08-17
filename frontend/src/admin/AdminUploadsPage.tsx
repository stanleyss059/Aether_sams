import { useEffect, useState } from "react";
import { api, ApiError, type AdminDocument, type Paginated } from "../api";
import { ConfirmModal } from "../ConfirmModal";
import { FileBadge, SaveDocumentButton } from "../FileBadge";
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
      <FilterBar
        onSubmit={() => {
          setPage(1);
          setSearch(q.trim());
        }}
      >
        <FilterInput
          placeholder="Search title, filename, or owner"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </FilterBar>

      {error ? <ErrorNote message={error} /> : null}

      {loading ? <LoadingRows /> : null}

      {!loading && data && data.items.length === 0 ? (
        <EmptyState
          title="No uploads found"
          description="No material matched that search. Try a filename, title, or owner email."
        />
      ) : null}

      {!loading && data && data.items.length > 0 ? (
        <>
          <ResultCount total={data.total} unit="upload" />
          <div className="grid gap-3">
            {data.items.map((doc) => (
              <RowCard key={doc.id}>
                <div className="flex min-w-0 items-start gap-3.5">
                  <FileBadge filename={doc.filename} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-lg font-bold tracking-[-0.02em] text-ink">{doc.title}</p>
                      {doc.space ? (
                        <Chip tone="accent">{doc.space.courseCode || doc.space.title}</Chip>
                      ) : (
                        <Chip>Unfiled</Chip>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted">{doc.filename}</p>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      <Pill>
                        {doc.quizCount} quiz{doc.quizCount === 1 ? "" : "zes"}
                      </Pill>
                      <Pill>Uploaded {new Date(doc.createdAt).toLocaleDateString()}</Pill>
                      <Pill>{doc.owner.name}</Pill>
                    </div>
                    <p className="mt-1.5 truncate text-xs text-muted">{doc.owner.email}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                  <SaveDocumentButton
                    documentId={doc.id}
                    filename={doc.filename}
                    admin
                    className="rounded-lg border border-forest/40 px-3.5 py-2 text-sm font-semibold text-forest hover:bg-forest/5 disabled:opacity-60"
                  />
                  <RowButton tone="danger" disabled={busyId === doc.id} onClick={() => setPending(doc)}>
                    Delete
                  </RowButton>
                </div>
              </RowCard>
            ))}
          </div>
        </>
      ) : null}

      {data ? (
        <Pager page={data.page} totalPages={data.totalPages} total={data.total} unit="upload" onChange={setPage} />
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
