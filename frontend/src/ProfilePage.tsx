import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, type User } from "./api";
import { useAuth } from "./AuthContext";

export function ProfilePage() {
  const { user, applyUser, logout } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await api<{ user: User }>("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      applyUser(data.user);
      setMessage("Name updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update your profile.");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/api/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.2em] text-gold uppercase">Account</p>
        <h1 className="font-serif text-3xl">Profile</h1>
        <p className="text-muted">Your StudyForge account stays private to you.</p>
      </div>

      {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {message ? <p className="rounded-md bg-forest/10 px-3 py-2 text-sm text-forest">{message}</p> : null}

      <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl">Details</h2>
        <form className="mt-4 space-y-4" onSubmit={saveProfile}>
          <label className="block text-sm font-semibold">
            Name
            <input className="mt-1 w-full rounded-md border border-line px-3 py-2.5" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </label>
          <label className="block text-sm font-semibold">
            Email
            <input className="mt-1 w-full rounded-md border border-line bg-parchment px-3 py-2.5 text-muted" value={user?.email ?? ""} readOnly />
          </label>
          <button className="rounded-md bg-forest px-4 py-2.5 font-semibold text-white" disabled={busy}>
            Save name
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl">Password</h2>
        <form className="mt-4 space-y-4" onSubmit={savePassword}>
          <label className="block text-sm font-semibold">
            Current password
            <input className="mt-1 w-full rounded-md border border-line px-3 py-2.5" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </label>
          <label className="block text-sm font-semibold">
            New password
            <input className="mt-1 w-full rounded-md border border-line px-3 py-2.5" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </label>
          <button className="rounded-md bg-forest px-4 py-2.5 font-semibold text-white" disabled={busy}>
            Change password
          </button>
        </form>
      </section>

      <button
        type="button"
        className="rounded-md border border-danger/30 px-4 py-2.5 font-semibold text-danger"
        onClick={async () => {
          await logout();
          navigate("/login");
        }}
      >
        Sign out
      </button>
    </div>
  );
}
