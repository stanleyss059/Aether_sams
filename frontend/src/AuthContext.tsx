import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError, type User } from "./api";
import { clearPageCache } from "./page-cache";
import { clearPasswordRecovery, detectRecoveryLink, isPasswordRecovery, markPasswordRecovery } from "./password-recovery";
import { supabase } from "./supabase";

export type RegisterResult = { needsEmailConfirmation: boolean };

type Auth = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<RegisterResult>;
  requestPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  applyUser: (user: User) => void;
};

const Ctx = createContext<Auth | null>(null);
const IDLE_MS = 24 * 60 * 60 * 1000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart", "click", "wheel"] as const;

async function fetchLocalUser(): Promise<User | null> {
  const me = await api<{ user: User | null }>("/api/auth/me");
  return me.user;
}

async function fetchLocalUserWithRetry(attempts = 3): Promise<User | null> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fetchLocalUser();
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError && (error.code === "SUSPENDED" || error.code === "UNAUTHORIZED")) {
        throw error;
      }
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not load your Aether account.");
}

async function hydrateUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  try {
    const user = await fetchLocalUserWithRetry();
    if (!user) {
      await supabase.auth.signOut();
      return null;
    }
    if (user.suspendedAt) {
      await supabase.auth.signOut();
      throw new ApiError("Your account has been suspended.", "SUSPENDED", 403);
    }
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.code === "SUSPENDED") throw error;
    // Fall through if the API is briefly unavailable during boot.
    return null;
  }
}

async function recordAuthEvent(event: "login" | "logout") {
  try {
    await api("/api/auth/events", {
      method: "POST",
      body: JSON.stringify({ event }),
    });
  } catch {
    // Audit recording must never block sign-in/out.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef(user);
  userRef.current = user;

  async function signOutQuietly() {
    try {
      if (userRef.current) await recordAuthEvent("logout");
    } catch {
      // Still clear the tab session.
    }
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Storage may already be gone (tab closing).
    }
    setUser(null);
  }

  useEffect(() => {
    let active = true;
    detectRecoveryLink();

    hydrateUser()
      .then((next) => {
        if (active) setUser(next);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        markPasswordRecovery();
      }
      if (!session) {
        clearPasswordRecovery();
        setUser(null);
        setLoading(false);
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION" || event === "PASSWORD_RECOVERY") {
        void hydrateUser()
          .then((next) => setUser(next))
          .catch(() => setUser(null))
          .finally(() => setLoading(false));
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user || isPasswordRecovery()) return;

    let idleTimer = 0;
    let armedAt = 0;

    function armIdleTimer() {
      window.clearTimeout(idleTimer);
      armedAt = Date.now();
      idleTimer = window.setTimeout(() => {
        void signOutQuietly();
      }, IDLE_MS);
    }

    function onActivity() {
      if (Date.now() - armedAt < 1000) return;
      armIdleTimer();
    }

    armIdleTimer();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }

    return () => {
      window.clearTimeout(idleTimer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
    };
  }, [user]);

  const value = useMemo<Auth>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw new Error(error.message);
        if (!data.session) throw new Error("Sign-in did not return a session.");
        const user = await fetchLocalUserWithRetry();
        if (!user) throw new Error("Could not load your Aether account.");
        if (user.suspendedAt) {
          await supabase.auth.signOut();
          throw new ApiError("Your account has been suspended.", "SUSPENDED", 403);
        }
        clearPageCache();
        setUser(user);
        await recordAuthEvent("login");
      },
      register: async (name, email, password) => {
        const normalizedEmail = email.trim().toLowerCase();
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: { name: name.trim() },
            emailRedirectTo: `${window.location.origin}/login`,
          },
        });
        if (error) throw new Error(error.message);

        if (data.session?.user) {
          const user = await fetchLocalUserWithRetry();
          if (user) {
            clearPageCache();
            setUser(user);
            await recordAuthEvent("login");
          }
          return { needsEmailConfirmation: false };
        }

        const signedIn = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signedIn.data.session?.user) {
          const user = await fetchLocalUserWithRetry();
          if (user) {
            clearPageCache();
            setUser(user);
            await recordAuthEvent("login");
          }
          return { needsEmailConfirmation: false };
        }

        return { needsEmailConfirmation: true };
      },
      requestPasswordReset: async (email) => {
        const origin = window.location.origin.replace(/\/$/, "");
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${origin}/reset-password`,
        });
        if (error) throw new Error(error.message);
      },
      logout: async () => {
        if (user) await recordAuthEvent("logout");
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(error.message);
        clearPageCache();
        setUser(null);
      },
      applyUser: (next) => setUser(next),
    }),
    [user, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}
