import { createClient, type SupportedStorage } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
  throw new Error("VITE_SUPABASE_URL must look like https://<project-ref>.supabase.co");
}

function persistentAuthStorage(): SupportedStorage | undefined {
  try {
    const probe = "__aether_session_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => {
        localStorage.setItem(key, value);
      },
      removeItem: (key) => {
        localStorage.removeItem(key);
      },
    };
  } catch {
    return undefined;
  }
}

const storage = persistentAuthStorage();

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: Boolean(storage),
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage,
    storageKey: "aether-auth",
  },
});
