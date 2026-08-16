import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "./api";
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

function mapUser(sessionUser: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
} | null): User | null {
  if (!sessionUser?.email) return null;
  const metaName = sessionUser.user_metadata?.name;
  const name = typeof metaName === "string" && metaName.trim() ? metaName.trim() : sessionUser.email.split("@")[0] ?? "Student";
  return { id: sessionUser.id, name, email: sessionUser.email };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(mapUser(data.session?.user ?? null));
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapUser(session?.user ?? null));
      setLoading(false);
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
        setUser(mapUser(data.user));
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
          setUser(mapUser(data.session.user));
          return { needsEmailConfirmation: false };
        }

        // Confirm-email may be off but session omitted — try signing in like login does.
        const signedIn = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (signedIn.data.session?.user) {
          setUser(mapUser(signedIn.data.session.user));
          return { needsEmailConfirmation: false };
        }

        return { needsEmailConfirmation: true };
      },
      logout: async () => {
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
