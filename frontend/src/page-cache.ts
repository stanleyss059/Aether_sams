import { useEffect, useState, useSyncExternalStore } from "react";
import { api } from "./api";

let epoch = 0;
const values = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();

function emit() {
  epoch += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function peekCache<T>(path: string) {
  return values.get(path) as T | undefined;
}

export function writeCache<T>(path: string, value: T) {
  values.set(path, value);
  emit();
}

export function invalidateExact(...paths: string[]) {
  let changed = false;
  for (const path of paths) {
    if (values.delete(path)) changed = true;
    inflight.delete(path);
  }
  if (changed) emit();
}

export function invalidatePrefix(prefix: string) {
  let changed = false;
  for (const path of [...values.keys()]) {
    if (path === prefix || path.startsWith(prefix)) {
      values.delete(path);
      inflight.delete(path);
      changed = true;
    }
  }
  if (changed) emit();
}

export function clearPageCache() {
  if (values.size === 0 && inflight.size === 0) return;
  values.clear();
  inflight.clear();
  emit();
}

/** Drop student library lists/details so the next visit loads fresh data. */
export function bumpLibrary() {
  invalidateExact("/api/spaces", "/api/documents", "/api/quizzes");
  invalidatePrefix("/api/spaces/");
  invalidatePrefix("/api/documents/");
  invalidatePrefix("/api/quizzes/");
}

export function bumpAdmin() {
  invalidatePrefix("/api/admin/");
}

export async function readCached<T>(path: string, force = false): Promise<T> {
  if (!force && values.has(path)) return values.get(path) as T;
  const pending = inflight.get(path);
  if (!force && pending) return pending as Promise<T>;
  const request = api<T>(path).then((value) => {
    values.set(path, value);
    emit();
    return value;
  });
  inflight.set(path, request);
  try {
    return await request;
  } finally {
    if (inflight.get(path) === request) inflight.delete(path);
  }
}

export function useCachedGet<T>(path: string | null) {
  const generation = useSyncExternalStore(subscribe, () => epoch, () => epoch);
  const cached = path ? peekCache<T>(path) : undefined;
  const [data, setData] = useState<T | undefined>(cached);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(() => Boolean(path) && cached === undefined);

  useEffect(() => {
    if (!path) {
      setData(undefined);
      setLoading(false);
      setError("");
      return;
    }
    const hit = peekCache<T>(path);
    if (hit !== undefined) {
      setData(hit);
      setLoading(false);
      setError("");
      return;
    }
    let cancelled = false;
    setLoading(true);
    readCached<T>(path)
      .then((value) => {
        if (!cancelled) {
          setData(value);
          setError("");
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, generation]);

  return { data, error, loading };
}
