"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shared per-user localStorage persistence.
 *
 * Every page in the app requires login, so all local drafts/preferences are
 * namespaced per user (`mt:<userId>:<key>`). Legacy global keys are adopted
 * once (migrated into the user namespace) so existing users keep their data.
 */

let cachedUserId: string | null | undefined;

function fetchUserId(): Promise<string | null> {
  return fetch("/api/auth/session", { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .then((payload) => {
      const id = (payload as { user?: { id?: string } } | null)?.user?.id;
      return typeof id === "string" && id.length > 0 ? id : null;
    })
    .catch(() => null);
}

/** Resolves the logged-in user id once (cached for the whole session). */
export function useCurrentUserId(): string | null {
  const [userId, setUserId] = useState<string | null>(() => cachedUserId ?? null);

  useEffect(() => {
    if (cachedUserId !== undefined) return;
    let cancelled = false;
    void fetchUserId().then((id) => {
      cachedUserId = id;
      if (!cancelled) setUserId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return userId;
}

export function storageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage);
  } catch {
    return false;
  }
}

export function userKey(userId: string, baseKey: string): string {
  return `mt:${userId}:${baseKey}`;
}

export function readStored<T>(key: string, fallback: T): T {
  try {
    if (!storageAvailable()) return fallback;
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Legacy keys were stored as raw strings (e.g. "grid", "Rock") —
      // only adopt the raw value when a string fallback is expected.
      return (typeof fallback === "string" ? raw : fallback) as unknown as T;
    }
  } catch {
    return fallback;
  }
}

export function readStoredRaw(key: string): string | null {
  try {
    if (!storageAvailable()) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    if (!storageAvailable()) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — drafts are best-effort.
  }
}

export function removeStored(key: string): void {
  try {
    if (!storageAvailable()) return;
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

type PersistentOptions = {
  /** Logged-in user id. Writes pause until known; legacy global key is used for first paint. */
  userId?: string | null;
  /** Debounce for writes (ms). Defaults to 600. */
  debounceMs?: number;
};

/**
 * useState backed by per-user localStorage.
 * - First paint reads the legacy global key (instant, SSR-safe).
 * - Once `userId` is known, adopts the namespaced value if present,
 *   otherwise seeds it from the current value (one-time migration).
 * - Every change is written back debounced.
 */
export function usePersistentState<T>(
  baseKey: string,
  initial: T,
  opts: PersistentOptions = {},
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const { userId = null, debounceMs = 600 } = opts;
  const [value, setValue] = useState<T>(() => readStored(baseKey, initial));
  const valueRef = useRef(value);
  const adoptedRef = useRef<string | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const namespacedKey = userId ? userKey(userId, baseKey) : null;

  useEffect(() => {
    if (!namespacedKey || adoptedRef.current === namespacedKey) return;
    adoptedRef.current = namespacedKey;
    const existing = readStored<T | null>(namespacedKey, null);
    if (existing !== null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(existing);
    } else {
      writeStored(namespacedKey, valueRef.current);
    }
  }, [namespacedKey]);

  useEffect(() => {
    if (!namespacedKey) return;
    const timer = window.setTimeout(() => writeStored(namespacedKey, valueRef.current), debounceMs);
    return () => window.clearTimeout(timer);
  }, [namespacedKey, value, debounceMs]);

  return [value, setValue];
}
