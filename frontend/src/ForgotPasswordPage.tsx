import { type FormEvent, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthCard } from "./AuthCard";
import { useAuth } from "./AuthContext";
import { Spinner } from "./Spinner";

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const location = useLocation();
  const presetEmail =
    typeof location.state === "object" && location.state && "email" in location.state
      ? String((location.state as { email?: string }).email ?? "")
      : "";
  const [email, setEmail] = useState(presetEmail);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a reset email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="Forgot password"
      subtitle="Enter the email on your account. If it is registered, we will send a reset link."
    >
      {sent ? (
        <div className="space-y-4">
          <p className="rounded-md bg-forest/10 px-3 py-2 text-sm text-forest">
            Check your inbox for a reset link. It may take a minute, and it can land in spam.
          </p>
          <p className="text-sm text-muted">
            <Link to="/login" className="font-semibold text-forest">
              Back to sign in
            </Link>
          </p>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          {error ? <p className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
          <label className="block text-sm font-semibold">
            Email
            <input
              className="mt-1 w-full rounded-md border border-line bg-surface px-3 py-2.5"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button
            className="inline-flex w-full items-center justify-center rounded-md bg-forest py-2.5 font-semibold text-white"
            disabled={busy}
          >
            {busy ? <Spinner size="sm" /> : "Send reset link"}
          </button>
          <p className="text-sm text-muted">
            Remembered it?{" "}
            <Link to="/login" className="font-semibold text-forest">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
}
