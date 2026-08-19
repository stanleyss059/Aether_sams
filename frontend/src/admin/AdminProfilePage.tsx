import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, type User } from "../api";
import { useAuth } from "../AuthContext";
import { supabase } from "../supabase";
import { Spinner } from "../Spinner";

const MIN_PASSWORD = 6;

export function AdminProfilePage() {
  const { user, applyUser, logout } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
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
      setBusy(false);
    }
  }

  async function savePassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
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
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl">Admin profile</h2>
        <p className="text-muted">Update your admin account details and password.</p>
      </div>

      {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {message ? <p className="rounded-md bg-forest/10 px-3 py-2 text-sm text-forest">{message}</p> : null}

      <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <h3 className="font-serif text-xl">Details</h3>
        <form className="mt-4 space-y-4" onSubmit={saveProfile}>
          <label className="block text-sm font-semibold">
            Name
            <input
              className="mt-1 w-full rounded-md border border-line px-3 py-2.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </label>
          <label className="block text-sm font-semibold">
            Email
            <input
              className="mt-1 w-full rounded-md border border-line bg-parchment px-3 py-2.5 text-muted"
              value={user?.email ?? ""}
              readOnly
            />
          </label>
          <p className="text-sm text-muted">Role: {user?.role ?? "ADMIN"}</p>
          <button className="rounded-md bg-forest px-4 py-2.5 font-semibold text-white" disabled={busy}>
            Save name
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <h3 className="font-serif text-xl">Change password</h3>
        <p className="mt-1 text-sm text-muted">
          Enter your current password, then choose a new one (at least {MIN_PASSWORD} characters).
        </p>
        <form className="mt-4 space-y-4" onSubmit={savePassword}>
          <label className="block text-sm font-semibold">
            Current password
            <input
              className="mt-1 w-full rounded-md border border-line px-3 py-2.5"
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
              className="mt-1 w-full rounded-md border border-line px-3 py-2.5"
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
              className="mt-1 w-full rounded-md border border-line px-3 py-2.5"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </label>
          <button className="inline-flex items-center justify-center rounded-md bg-forest px-4 py-2.5 font-semibold text-white" disabled={busy}>
            {busy ? <Spinner size="sm" /> : "Change password"}
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
