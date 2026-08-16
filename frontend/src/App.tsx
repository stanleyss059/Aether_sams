import { Navigate, Outlet, Route, Routes, Link, useNavigate, useParams } from "react-router-dom";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { api, ApiError, type DocDetail } from "./api";
import { ConfirmModal } from "./ConfirmModal";
import { DashboardPage } from "./DashboardPage";
import { NavBar } from "./NavBar";
import { ProfilePage } from "./ProfilePage";
import { QuizPage } from "./QuizPage";
import { SpacePage } from "./SpacePage";
import { SpacesPage } from "./SpacesPage";
import { UploadsPage } from "./UploadsPage";
import { AdminShell } from "./admin/AdminShell";
import { AdminDashboardPage } from "./admin/AdminDashboardPage";
import { AdminUsersPage } from "./admin/AdminUsersPage";
import { AdminUploadsPage } from "./admin/AdminUploadsPage";
import { AdminSpacesPage } from "./admin/AdminSpacesPage";
import { AdminAuditLogsPage } from "./admin/AdminAuditLogsPage";
import { AdminProfilePage } from "./admin/AdminProfilePage";

function Guard() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <Shell />;
}

function AdminGuard() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-muted">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "ADMIN") return <Navigate to="/" replace />;
  return <Outlet />;
}

function Shell() {
  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Sign in" subtitle="Create a course space, upload notes, and generate quizzes from your own material.">
      <form className="space-y-4" onSubmit={onSubmit}>
        {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
        <label className="block text-sm font-semibold">
          Email
          <input className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm font-semibold">
          Password
          <input className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="w-full rounded-md bg-forest py-2.5 font-semibold text-white" disabled={busy}>
          {busy ? "Signing in…" : "Continue"}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        New here? <Link to="/register">Create an account</Link>
      </p>
    </AuthCard>
  );
}

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    try {
      const result = await register(name, email, password);
      if (result.needsEmailConfirmation) {
        setInfo("Account created. Check your email to confirm, then sign in.");
        return;
      }
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard title="Create account" subtitle="Your uploads stay private to your account.">
      <form className="space-y-4" onSubmit={onSubmit}>
        {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
        {info ? <p className="rounded-md bg-forest/10 px-3 py-2 text-sm text-forest">{info}</p> : null}
        <label className="block text-sm font-semibold">
          Name
          <input className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5" required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-sm font-semibold">
          Email
          <input className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm font-semibold">
          Password
          <input className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2.5" type="password" minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="w-full rounded-md bg-forest py-2.5 font-semibold text-white" disabled={busy}>
          {busy ? "Creating…" : "Register"}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthCard>
  );
}

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 shadow-sm">
        <p className="font-serif text-2xl text-forest">StudyForge</p>
        <h1 className="mt-4 font-serif text-3xl">{title}</h1>
        <p className="mt-1 mb-6 text-sm text-muted">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

function DocumentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function load() {
    if (!id) return;
    setDoc(await api<DocDetail>(`/api/documents/${id}`));
  }

  useEffect(() => {
    load().catch((err: Error) => setError(err.message));
  }, [id]);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ quizId: string }>(`/api/documents/${id}/generate`, {
        method: "POST",
        body: JSON.stringify({ count: 50 }),
      });
      await load();
      navigate(`/quizzes/${data.quizId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not generate a quiz.");
    } finally {
      setBusy(false);
    }
  }

  async function removeDoc() {
    if (!id || !doc) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/documents/${id}`, { method: "DELETE" });
      navigate(doc.space ? `/spaces/${doc.space.id}` : "/uploads");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete that upload.");
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  if (!doc && !error) return <p>Loading…</p>;
  if (!doc) return <p className="text-danger">{error}</p>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        <Link to="/spaces" className="text-muted no-underline hover:text-forest">
          Spaces
        </Link>
        {doc.space ? (
          <>
            <span> / </span>
            <Link to={`/spaces/${doc.space.id}`} className="text-muted no-underline hover:text-forest">
              {doc.space.courseCode || doc.space.title}
            </Link>
          </>
        ) : null}
      </p>
      <h1 className="font-serif text-3xl">{doc.title}</h1>
      {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-md bg-forest px-4 py-2.5 font-semibold text-white disabled:opacity-60"
          disabled={busy}
          onClick={generate}
        >
          {busy ? "Generating from your upload…" : "Generate 50 MCQs from this file"}
        </button>
        {doc.quizzes[0] ? (
          <Link
            to={`/quizzes/${doc.quizzes[0].id}`}
            className="rounded-md border border-forest px-4 py-2.5 font-semibold text-forest no-underline hover:bg-forest/5"
          >
            Attempt quiz
          </Link>
        ) : null}
        <button
          type="button"
          className="rounded-md border border-danger/30 px-4 py-2.5 font-semibold text-danger disabled:opacity-60"
          disabled={busy}
          onClick={() => setConfirmOpen(true)}
        >
          Remove upload
        </button>
      </div>
      {doc.summary ? (
        <section className="rounded-xl border border-line bg-white p-5">
          <h2 className="font-serif text-xl">Study notes</h2>
          <p className="mt-2 whitespace-pre-wrap leading-relaxed text-ink">{doc.summary}</p>
        </section>
      ) : null}
      <section className="rounded-xl border border-line bg-white p-5">
        <h2 className="font-serif text-xl">Extracted excerpt</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">{doc.excerpt}</p>
      </section>
      <section>
        <h2 className="font-serif text-xl">Quizzes</h2>
        <div className="mt-3 grid gap-2">
          {doc.quizzes.map((quiz, index) => (
            <Link
              key={quiz.id}
              to={`/quizzes/${quiz.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3 no-underline"
            >
              <span>
                {quiz.title} · {quiz.questionCount} questions
                {quiz.attemptCount > 0
                  ? ` · ${quiz.attemptCount} attempt${quiz.attemptCount === 1 ? "" : "s"}`
                  : ""}
              </span>
              <span className="shrink-0 font-semibold text-forest">
                {index === 0 ? "Attempt quiz" : "Open quiz"} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <ConfirmModal
        open={confirmOpen}
        title={`Delete “${doc.title}”?`}
        description="This permanently removes the upload and any quizzes generated from it."
        confirmLabel="Delete upload"
        busy={busy && confirmOpen}
        onCancel={() => {
          if (!busy) setConfirmOpen(false);
        }}
        onConfirm={removeDoc}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<Guard />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/spaces" element={<SpacesPage />} />
          <Route path="/spaces/:id" element={<SpacePage />} />
          <Route path="/uploads" element={<UploadsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/documents/:id" element={<DocumentPage />} />
          <Route path="/quizzes/:id" element={<QuizPage />} />
          <Route path="/admin" element={<AdminGuard />}>
            <Route element={<AdminShell />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="uploads" element={<AdminUploadsPage />} />
              <Route path="spaces" element={<AdminSpacesPage />} />
              <Route path="profile" element={<AdminProfilePage />} />
              <Route path="audit-logs" element={<AdminAuditLogsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
