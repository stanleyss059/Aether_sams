import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, type User } from "./api";
import { supabase } from "./supabase";

export type RegisterResult = { needsEmailConfirmation: boolean };

type Auth = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  applyUser: (user: User) => void;
};

const Ctx = createContext<Auth | null>(null);

async function hydrateUser(): Promise<User | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  try {
    const me = await api<{ user: User | null }>("/api/auth/me");
    if (!me.user) return null;
    if (me.user.suspendedAt) {
      await supabase.auth.signOut();
      throw new ApiError("Your account has been suspended.", "SUSPENDED", 403);
    }
    return me.user;
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

  useEffect(() => {
    let active = true;

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
      if (!session) {
        setUser(null);
        setLoading(false);
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
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
        const me = await api<{ user: User | null }>("/api/auth/me");
        if (!me.user) throw new Error("Could not load your StudyForge account.");
        if (me.user.suspendedAt) {
          await supabase.auth.signOut();
          throw new ApiError("Your account has been suspended.", "SUSPENDED", 403);
        }
        setUser(me.user);
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
          const me = await api<{ user: User | null }>("/api/auth/me");
          if (me.user) {
            setUser(me.user);
            await recordAuthEvent("login");
          }
          return { needsEmailConfirmation: false };
        }

        const signedIn = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signedIn.data.session?.user) {
          const me = await api<{ user: User | null }>("/api/auth/me");
          if (me.user) {
            setUser(me.user);
            await recordAuthEvent("login");
          }
          return { needsEmailConfirmation: false };
        }

        return { needsEmailConfirmation: true };
      },
      logout: async () => {
        if (user) await recordAuthEvent("logout");
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(error.message);
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
