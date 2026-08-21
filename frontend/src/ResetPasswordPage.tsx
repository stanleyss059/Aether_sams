import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthCard } from "./AuthCard";
import { supabase } from "./supabase";
import { LoadingState, Spinner } from "./Spinner";

const MIN_PASSWORD = 6;

function readLinkError() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  return hash.get("error_description") || query.get("error_description") || hash.get("error") || query.get("error");
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fromLink = readLinkError();
    if (fromLink) {
      setLinkError(fromLink.replace(/\+/g, " "));
      setChecking(false);
      return;
    }

    let active = true;

    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        setHasSession(true);
        setChecking(false);
      }
    }

    void checkSession();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        setHasSession(true);
        setChecking(false);
      }
    });

    const timeout = window.setTimeout(() => {
      if (!active) return;
      setChecking(false);
    }, 4000);

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("New password and confirmation do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);
      await supabase.auth.signOut();
      navigate("/login", {
        replace: true,
        state: { notice: "Password updated. Sign in with your new password." },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return <LoadingState className="flex min-h-screen items-center justify-center p-8" />;
  }

  if (linkError || !hasSession) {
    return (
      <AuthCard title="Reset link expired" subtitle="This password reset link is invalid or has already been used.">
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {linkError || "Request a new reset email and open the latest link."}
        </p>
        <p className="mt-4 text-sm text-muted">
          <Link to="/forgot-password" className="font-semibold text-forest">
            Send a new reset link
          </Link>
          {" · "}
          <Link to="/login" className="font-semibold text-forest">
            Sign in
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Set a new password" subtitle="Choose a password you have not used on this account before.">
      <form className="space-y-4" onSubmit={onSubmit}>
        {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
        <label className="block text-sm font-semibold">
          New password
          <input
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2.5"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold">
          Confirm password
          <input
            className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2.5"
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>
        <button
          className="inline-flex w-full items-center justify-center rounded-md bg-forest py-2.5 font-semibold text-white"
          disabled={busy}
        >
          {busy ? <Spinner size="sm" /> : "Update password"}
        </button>
      </form>
    </AuthCard>
  );
}
