import { createClient, type SupportedStorage } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.");
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
  throw new Error("VITE_SUPABASE_URL must look like https://<project-ref>.supabase.co");
}

function tabSessionStorage(): SupportedStorage | undefined {
  try {
    const probe = "__aether_session_probe__";
    sessionStorage.setItem(probe, "1");
    sessionStorage.removeItem(probe);
    return {
      getItem: (key) => sessionStorage.getItem(key),
      setItem: (key, value) => {
        sessionStorage.setItem(key, value);
      },
      removeItem: (key) => {
        sessionStorage.removeItem(key);
      },
    };
  } catch {
    return undefined;
  }
}

const storage = tabSessionStorage();

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: Boolean(storage),
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage,
    storageKey: "aether-auth",
  },
});
