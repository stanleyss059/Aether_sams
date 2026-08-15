import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type DocListItem } from "./api";

export function UploadsPage() {
  const [docs, setDocs] = useState<DocListItem[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<DocListItem[]>("/api/documents")
      .then(setDocs)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Library</p>
        <h1 className="font-serif text-3xl">My uploads</h1>
        <p className="text-muted">Every file you have uploaded, across all course spaces.</p>
      </div>
      {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {loading ? <p className="text-muted">Loading uploads…</p> : null}
      {!loading && docs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-white/60 px-4 py-8 text-center text-muted">
          No uploads yet. <Link to="/spaces">Open a space</Link> and add lecture notes.
        </p>
      ) : (
        <div className="grid gap-3">
          {docs.map((doc) => (
            <Link key={doc.id} to={`/documents/${doc.id}`} className="rounded-2xl border border-line bg-white p-4 no-underline shadow-sm">
              <p className="font-serif text-xl text-ink">{doc.title}</p>
              <p className="text-sm text-muted">
                {doc.filename}
                {doc.space ? ` · ${doc.space.courseCode ? `${doc.space.courseCode} · ` : ""}${doc.space.title}` : " · Unfiled"}
                {` · ${doc.quizCount} quiz${doc.quizCount === 1 ? "" : "zes"}`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
