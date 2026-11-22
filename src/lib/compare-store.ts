"use client";
// Compare selection (max 4), persisted in localStorage and shared by every component through useSyncExternalStore.
// localStorage can throw (private mode, blocked storage): every access is guarded and the store still works in memory.
import { useSyncExternalStore } from "react";

export const COMPARE_MAX = 4;
export interface CompareEntry {
  id: string; // "lab/slug"
  name: string;
  labName: string;
}

const KEY = "oneatlas:compare";
const EMPTY: CompareEntry[] = [];
let current: CompareEntry[] | null = null;
const listeners = new Set<() => void>();

function read(): CompareEntry[] {
  if (current) return current;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    current = Array.isArray(parsed)
      ? parsed.filter((e): e is CompareEntry => typeof e?.id === "string" && typeof e?.name === "string").slice(0, COMPARE_MAX)
      : [];
  } catch {
    current = [];
  }
  return current;
}

function write(next: CompareEntry[]) {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: keep the in-memory selection */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      current = null; // another tab changed it
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Stable (module-level) so it can sit in effect dependencies; skips the write when nothing changed. */
export function replaceCompareList(entries: CompareEntry[]) {
  const next = entries.slice(0, COMPARE_MAX);
  const cur = read();
  if (cur.length === next.length && cur.every((e, i) => e.id === next[i].id && e.name === next[i].name)) return;
  write(next);
}

export function useCompareList() {
  const items = useSyncExternalStore(subscribe, read, () => EMPTY);
  const has = (id: string) => items.some((e) => e.id === id);
  return {
    items,
    has,
    isFull: items.length >= COMPARE_MAX,
    /** Adds or removes; returns false when adding would exceed the maximum. */
    toggle(entry: CompareEntry): boolean {
      if (has(entry.id)) {
        write(items.filter((e) => e.id !== entry.id));
        return true;
      }
      if (items.length >= COMPARE_MAX) return false;
      write([...items, entry]);
      return true;
    },
    remove: (id: string) => write(items.filter((e) => e.id !== id)),
    clear: () => write([]),
  };
}
