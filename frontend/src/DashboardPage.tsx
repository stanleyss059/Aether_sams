import { Link } from "react-router-dom";
import { ACCENTS, accentOf } from "./accents";
import { useAuth } from "./AuthContext";
import { type DocListItem, type LibraryData, type QuizListItem } from "./api";
import { FileBadge } from "./FileBadge";
import { useCachedGet } from "./page-cache";
import { LoadingState } from "./Spinner";

export function DashboardPage() {
  const { user } = useAuth();
  const spacesQuery = useCachedGet<LibraryData>("/api/spaces");
  const docsQuery = useCachedGet<DocListItem[]>("/api/documents");
  const quizzesQuery = useCachedGet<QuizListItem[]>("/api/quizzes");
  const library = spacesQuery.data ?? null;
  const docs = docsQuery.data ?? [];
  const quizCount = quizzesQuery.data?.length ?? 0;
  const error = spacesQuery.error || docsQuery.error || quizzesQuery.error;
  const loading = spacesQuery.loading || docsQuery.loading || quizzesQuery.loading;

  const spaceCount = library?.spaces.length ?? 0;
  const uploadCount = docs.length;
  const firstName = user?.name.split(" ")[0] ?? "there";

  return (
    <div className="space-y-8">
      <div className="card relative overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-20 right-0 h-52 w-52 rounded-full bg-forest/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-10 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative">
          <span className="inline-flex rounded-full bg-forest/10 px-2.5 py-1 text-xs font-bold text-forest">DASHBOARD</span>
          <h1 className="mt-4 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Welcome back, {firstName}</h1>
          <p className="mt-2 max-w-2xl leading-7 text-muted">
            Pick up a course space, or generate a quiz from something you already uploaded.
          </p>
        </div>
      </div>

      {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      {loading ? (
        <LoadingState className="flex items-center justify-center py-16" />
      ) : (
      <>
      <div className="stagger grid gap-3 sm:grid-cols-3">
        <Stat label="Spaces" value={spaceCount} to="/spaces" />
        <Stat label="Uploads" value={uploadCount} to="/uploads" />
        <Stat label="Quizzes" value={quizCount} to="/quizzes" />
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-bold tracking-[-0.03em]">Your spaces</h2>
          <Link to="/spaces" className="text-sm font-semibold text-forest">
            View all
          </Link>
        </div>
        {library && library.spaces.length === 0 ? (
          <p className="card-empty px-4 py-10 text-center text-muted">
            No spaces yet. <Link to="/spaces">Create a course deck</Link> to group related notes.
          </p>
        ) : (
          <div className="stagger grid gap-3 sm:grid-cols-2">
            {library?.spaces.slice(0, 4).map((space) => {
              const look = ACCENTS[accentOf(space.accent)];
              return (
                <Link
                  key={space.id}
                  to={`/spaces/${space.id}`}
                  className="lift-card group overflow-hidden rounded-2xl border border-line bg-surface no-underline"
                >
                  <div className={`h-1.5 ${look.bar}`} />
                  <div className="p-5">
                    {space.courseCode ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${look.chip}`}>{space.courseCode}</span>
                    ) : null}
                    <p className="mt-2 truncate text-xl font-bold tracking-[-0.03em] text-ink">{space.title}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-sm text-muted">
                        {space.documentCount} material{space.documentCount === 1 ? "" : "s"} · {space.quizCount} quiz
                        {space.quizCount === 1 ? "" : "zes"}
                      </p>
                      <span className="text-lg text-muted transition group-hover:translate-x-0.5 group-hover:text-forest">
                        →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-bold tracking-[-0.03em]">Recent uploads</h2>
          <Link to="/uploads" className="text-sm font-semibold text-forest">
            My uploads
          </Link>
        </div>
        {docs.length === 0 ? (
          <p className="card-empty px-4 py-10 text-center text-muted">
            Nothing uploaded yet. Open a space and add lecture notes.
          </p>
        ) : (
          <div className="stagger grid gap-2">
            {docs.slice(0, 5).map((doc) => (
              <Link
                key={doc.id}
                to={`/documents/${doc.id}`}
                className="lift-card flex items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-3.5 no-underline"
              >
                <FileBadge filename={doc.filename} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{doc.title}</p>
                  <p className="truncate text-sm text-muted">
                    {doc.space?.courseCode || doc.space?.title || "Unfiled"} · {doc.quizCount} quiz
                    {doc.quizCount === 1 ? "" : "zes"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      </>
      )}
    </div>
  );
}

function Stat({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link
      to={to}
      className="lift-card group rounded-2xl border border-line bg-surface p-5 no-underline"
    >
      <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">{label}</p>
      <div className="mt-4 flex items-end justify-between">
        <p className="text-4xl font-bold tracking-[-0.06em] text-ink">{value}</p>
        <span className="grid h-8 w-8 place-items-center rounded-full bg-forest/10 text-forest transition group-hover:translate-x-0.5">
          →
        </span>
      </div>
    </Link>
  );
}
