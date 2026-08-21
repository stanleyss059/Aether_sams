import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError, type DocListItem, type LibraryData, type User } from "./api";
import { useAuth } from "./AuthContext";
import { IconLock, IconMail, IconProfile, IconSignOut } from "./nav-icons";
import { Spinner } from "./Spinner";
import { supabase } from "./supabase";

const MIN_PASSWORD = 6;

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function joinedLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function ProfilePage() {
  const { user, applyUser, logout } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"name" | "password" | "logout" | null>(null);
  const [spaceCount, setSpaceCount] = useState<number | null>(null);
  const [uploadCount, setUploadCount] = useState<number | null>(null);
  const [quizCount, setQuizCount] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([api<LibraryData>("/api/spaces"), api<DocListItem[]>("/api/documents")])
      .then(([library, documents]) => {
        setSpaceCount(library.spaces.length);
        setUploadCount(documents.length);
        setQuizCount(documents.reduce((sum, doc) => sum + doc.quizCount, 0));
      })
      .catch(() => {
        setSpaceCount(0);
        setUploadCount(0);
        setQuizCount(0);
      });
  }, []);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy("name");
    setError("");
    setMessage("");
    try {
      const { error: metaError } = await supabase.auth.updateUser({ data: { name } });
      if (metaError) throw new Error(metaError.message);
      const data = await api<{ user: User }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      applyUser(data.user);
      setMessage("Name updated.");
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Could not update your profile.");
    } finally {
      setBusy(null);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setBusy("password");
    setError("");
    setMessage("");
    try {
      if (!user?.email) throw new Error("Not signed in.");
      if (newPassword.length < MIN_PASSWORD) {
        throw new Error(`New password must be at least ${MIN_PASSWORD} characters.`);
      }
      if (newPassword !== confirmPassword) {
        throw new Error("New password and confirmation do not match.");
      }
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) throw new Error("Current password is incorrect.");
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw new Error(updateError.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage("Password updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your password.");
    } finally {
      setBusy(null);
    }
  }

  async function onSignOut() {
    setBusy("logout");
    try {
      await logout();
      navigate("/login");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-line bg-surface">
        <div className="h-1.5 bg-gradient-to-r from-forest via-gold to-forest" />
        <div className="relative p-6 sm:p-8">
          <div className="pointer-events-none absolute -top-16 right-0 h-48 w-48 rounded-full bg-forest/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-forest to-forest-800 text-2xl font-extrabold text-white shadow-lg shadow-forest/25">
              {initials(user?.name ?? "?")}
            </div>
            <div className="min-w-0 flex-1">
              <span className="inline-flex rounded-full bg-forest/10 px-2.5 py-1 text-xs font-bold text-forest">
                ACCOUNT
              </span>
              <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">{user?.name ?? "Profile"}</h1>
              <p className="mt-1 flex items-center gap-2 text-muted">
                <IconMail className="h-4 w-4 shrink-0" />
                <span className="truncate">{user?.email}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-parchment px-2.5 py-1 text-xs font-bold text-ink">
                  {user?.role === "ADMIN" ? "Admin" : "Student"}
                </span>
                <span className="rounded-full bg-parchment px-2.5 py-1 text-xs font-bold text-muted">
                  Joined {user?.createdAt ? joinedLabel(user.createdAt) : "recently"}
                </span>
                {user?.role === "ADMIN" ? (
                  <Link
                    to="/admin"
                    className="rounded-full bg-forest/10 px-2.5 py-1 text-xs font-bold text-forest no-underline"
                  >
                    Open admin →
                  </Link>
                ) : null}
              </div>
            </div>
          </div>

          <div className="stagger relative mt-6 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Spaces" value={spaceCount} to="/spaces" />
            <MiniStat label="Uploads" value={uploadCount} to="/uploads" />
            <MiniStat label="Quizzes" value={quizCount} to="/uploads" />
          </div>
        </div>
      </section>

      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-medium text-danger">{error}</p> : null}
      {message ? <p className="rounded-xl bg-forest/10 px-4 py-3 text-sm font-medium text-forest">{message}</p> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest/10 text-forest">
              <IconProfile className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-[-0.03em]">Profile details</h2>
              <p className="mt-0.5 text-sm text-muted">This name is shown in your spaces and quizzes.</p>
            </div>
          </div>
          <form className="mt-5 space-y-4" onSubmit={saveProfile}>
            <label className="block text-sm font-semibold">
              Display name
              <input
                className="mt-1.5 w-full rounded-xl border border-line px-3.5 py-2.5"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </label>
            <label className="block text-sm font-semibold">
              Email
              <input
                className="mt-1.5 w-full rounded-xl border border-line bg-parchment px-3.5 py-2.5 text-muted"
                value={user?.email ?? ""}
                readOnly
              />
            </label>
            <p className="text-xs text-muted">Email is tied to your sign-in and cannot be changed here.</p>
            <button
              className="inline-flex items-center justify-center rounded-xl bg-forest px-4 py-2.5 font-semibold text-white"
              disabled={busy !== null}
            >
              {busy === "name" ? <Spinner size="sm" /> : "Save name"}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/10 text-gold">
              <IconLock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-[-0.03em]">Password</h2>
              <p className="mt-0.5 text-sm text-muted">
                Use at least {MIN_PASSWORD} characters. You’ll need the current password to change it.
              </p>
            </div>
          </div>
          <form className="mt-5 space-y-4" onSubmit={savePassword}>
            <label className="block text-sm font-semibold">
              Current password
              <input
                className="mt-1.5 w-full rounded-xl border border-line px-3.5 py-2.5"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm font-semibold">
              New password
              <input
                className="mt-1.5 w-full rounded-xl border border-line px-3.5 py-2.5"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm font-semibold">
              Confirm new password
              <input
                className="mt-1.5 w-full rounded-xl border border-line px-3.5 py-2.5"
                type="password"
                autoComplete="new-password"
                minLength={MIN_PASSWORD}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>
            <button
              className="inline-flex items-center justify-center rounded-xl bg-forest px-4 py-2.5 font-semibold text-white"
              disabled={busy !== null}
            >
              {busy === "password" ? <Spinner size="sm" /> : "Update password"}
            </button>
          </form>
        </section>
      </div>

      <section className="rounded-3xl border border-danger/20 bg-danger/[0.04] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger/10 text-danger">
              <IconSignOut className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-[-0.03em]">Sign out</h2>
              <p className="mt-0.5 text-sm text-muted">End this session on this device. Your notes and quizzes stay saved.</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl border border-danger/30 px-4 py-2.5 font-semibold text-danger"
            disabled={busy !== null}
            onClick={onSignOut}
          >
            {busy === "logout" ? <Spinner size="sm" className="text-danger" /> : "Sign out"}
          </button>
        </div>
      </section>
    </div>
  );
}

function MiniStat({ label, value, to }: { label: string; value: number | null; to: string }) {
  return (
    <Link to={to} className="lift-card rounded-2xl border border-line bg-parchment/70 px-4 py-3.5 no-underline">
      <p className="text-[11px] font-bold tracking-[0.14em] text-muted uppercase">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-[-0.04em] text-ink">{value ?? "—"}</p>
    </Link>
  );
}
