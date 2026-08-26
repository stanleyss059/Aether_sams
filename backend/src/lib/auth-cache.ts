import type { AppUser } from "./supabase.js";

const CACHE_MS = 45_000;
const cache = new Map<string, { user: AppUser; until: number }>();

export function cachedUser(token: string) {
  const hit = cache.get(token);
  if (!hit) return null;
  if (hit.until < Date.now()) {
    cache.delete(token);
    return null;
  }
  return hit.user;
}

export function rememberUser(token: string, user: AppUser) {
  cache.set(token, { user, until: Date.now() + CACHE_MS });
  if (cache.size > 500) {
    const now = Date.now();
    for (const [key, value] of cache) {
      if (value.until < now) cache.delete(key);
    }
  }
}
