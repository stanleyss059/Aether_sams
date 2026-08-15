import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ACCENTS, accentOf } from "./accents";
import { useAuth } from "./AuthContext";
import { api, type DocListItem, type LibraryData } from "./api";

export function DashboardPage() {
  const { user } = useAuth();
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [docs, setDocs] = useState<DocListItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api<LibraryData>("/api/spaces"), api<DocListItem[]>("/api/documents")])
      .then(([spaces, documents]) => {
        setLibrary(spaces);
        setDocs(documents);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  const spaceCount = library?.spaces.length ?? 0;
  const uploadCount = docs.length;
  const quizCount = docs.reduce((sum, doc) => sum + doc.quizCount, 0);
  const firstName = user?.name.split(" ")[0] ?? "there";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Dashboard</p>
        <h1 className="font-serif text-3xl">Welcome back, {firstName}</h1>
        <p className="text-muted">Pick up a course space, or generate a quiz from something you already uploaded.</p>
      </div>

      {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Spaces" value={spaceCount} to="/spaces" />
        <Stat label="Uploads" value={uploadCount} to="/uploads" />
        <Stat label="Quizzes" value={quizCount} to="/uploads" />
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-serif text-xl">Your spaces</h2>
          <Link to="/spaces" className="text-sm font-semibold text-forest">
            View all
          </Link>
        </div>
        {library && library.spaces.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-8 text-center text-muted">
            No spaces yet. <Link to="/spaces">Create a course deck</Link> to group related notes.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {library?.spaces.slice(0, 4).map((space) => {
              const look = ACCENTS[accentOf(space.accent)];
              return (
                <Link
                  key={space.id}
                  to={`/spaces/${space.id}`}
                  className="overflow-hidden rounded-2xl border border-line bg-white no-underline shadow-sm"
                >
                  <div className={`h-1.5 ${look.bar}`} />
                  <div className="p-4">
                    {space.courseCode ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${look.chip}`}>{space.courseCode}</span>
                    ) : null}
                    <p className="mt-2 font-serif text-xl text-ink">{space.title}</p>
                    <p className="text-sm text-muted">
                      {space.documentCount} material{space.documentCount === 1 ? "" : "s"} · {space.quizCount} quiz
                      {space.quizCount === 1 ? "" : "zes"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-serif text-xl">Recent uploads</h2>
          <Link to="/uploads" className="text-sm font-semibold text-forest">
            My uploads
          </Link>
        </div>
        {docs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-8 text-center text-muted">
            Nothing uploaded yet. Open a space and add lecture notes.
          </p>
        ) : (
          <div className="grid gap-2">
            {docs.slice(0, 5).map((doc) => (
              <Link key={doc.id} to={`/documents/${doc.id}`} className="rounded-xl border border-line bg-white px-4 py-3 no-underline">
                <p className="font-semibold text-ink">{doc.title}</p>
                <p className="text-sm text-muted">
                  {doc.space?.courseCode || doc.space?.title || "Unfiled"} · {doc.quizCount} quiz
                  {doc.quizCount === 1 ? "" : "zes"}
                </p>
              </Link>
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
