"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Client-only "Сравнение" (compare) store for the public catalog.
 *
 * Mirrors the Favorites architecture (see lib/favorites.tsx): no public-site
 * auth, so selection lives entirely in localStorage as a JSON array. A React
 * context is the single source of truth so the card toggles, the floating
 * compare bar, and the /compare page stay in sync; a `storage` listener keeps
 * other tabs in sync too.
 *
 * Difference from Favorites: each entry carries the property TYPE, because
 * comparison is only meaningful between same-type properties — so we can enforce
 * the same-type constraint (and the max-4 cap) without re-fetching.
 */

export const COMPARE_LS_KEY = "centreal_compare";
export const COMPARE_MAX = 4;

export type ComparePropertyType =
  | "apartment"
  | "house"
  | "land"
  | "commercial";

export interface CompareEntry {
  slug: string;
  type: ComparePropertyType;
}

/** Result of an add/toggle attempt so the UI can surface a reason on failure. */
export interface CompareToggleResult {
  ok: boolean;
  /** Set when ok=false. */
  reason?: "max" | "type_mismatch";
  message?: string;
}

const TYPES: readonly string[] = ["apartment", "house", "land", "commercial"];

function isCompareType(v: unknown): v is ComparePropertyType {
  return typeof v === "string" && TYPES.includes(v);
}

function readFromStorage(): CompareEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(COMPARE_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    const out: CompareEntry[] = [];
    for (const x of parsed) {
      if (
        x &&
        typeof x === "object" &&
        typeof x.slug === "string" &&
        x.slug.length > 0 &&
        isCompareType(x.type) &&
        !seen.has(x.slug)
      ) {
        seen.add(x.slug);
        out.push({ slug: x.slug, type: x.type });
      }
    }
    return out.slice(0, COMPARE_MAX);
  } catch {
    return [];
  }
}

function writeToStorage(entries: CompareEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COMPARE_LS_KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable (private mode, quota) — the in-memory state still
    // reflects the change for this session.
  }
}

interface CompareContextValue {
  /** Ordered compare entries (newest first). */
  entries: CompareEntry[];
  /** Just the slugs, in the same order. */
  slugs: string[];
  count: number;
  /** The property type currently locked in (all entries share it), or null. */
  activeType: ComparePropertyType | null;
  /** Whether the store has hydrated from localStorage (avoids SSR mismatch). */
  ready: boolean;
  isComparing: (slug: string) => boolean;
  /**
   * Add if absent (respecting same-type + max-4), remove if present. Returns a
   * result so the caller can show a message when an add is blocked.
   */
  toggleCompare: (slug: string, type: ComparePropertyType) => CompareToggleResult;
  removeCompare: (slug: string) => void;
  clearCompare: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

const OK: CompareToggleResult = { ok: true };

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<CompareEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEntries(readFromStorage());
    setReady(true);
  }, []);

  // Cross-tab sync (same pattern as FavoritesProvider / HeaderAccountControls).
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === COMPARE_LS_KEY || e.key === null) {
        setEntries(readFromStorage());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const removeCompare = useCallback((slug: string) => {
    setEntries((prev) => {
      if (!prev.some((e) => e.slug === slug)) return prev;
      const next = prev.filter((e) => e.slug !== slug);
      writeToStorage(next);
      return next;
    });
  }, []);

  const clearCompare = useCallback(() => {
    setEntries([]);
    writeToStorage([]);
  }, []);

  const toggleCompare = useCallback(
    (slug: string, type: ComparePropertyType): CompareToggleResult => {
      if (!slug || !isCompareType(type)) return { ok: false };

      // Removal is always allowed and never blocked.
      const already = entries.some((e) => e.slug === slug);
      if (already) {
        removeCompare(slug);
        return OK;
      }

      // Add path — enforce same-type then max-4.
      const activeType = entries[0]?.type ?? null;
      if (activeType !== null && activeType !== type) {
        return {
          ok: false,
          reason: "type_mismatch",
          message: "Сравнивать можно только объекты одного типа",
        };
      }
      if (entries.length >= COMPARE_MAX) {
        return {
          ok: false,
          reason: "max",
          message: `Можно сравнить максимум ${COMPARE_MAX} объекта`,
        };
      }

      setEntries((prev) => {
        // Re-check inside the updater against the latest state.
        if (prev.some((e) => e.slug === slug)) return prev;
        const at = prev[0]?.type ?? null;
        if ((at !== null && at !== type) || prev.length >= COMPARE_MAX) {
          return prev;
        }
        const next = [{ slug, type }, ...prev];
        writeToStorage(next);
        return next;
      });
      return OK;
    },
    [entries, removeCompare],
  );

  const isComparing = useCallback(
    (slug: string) => entries.some((e) => e.slug === slug),
    [entries],
  );

  const value = useMemo<CompareContextValue>(() => {
    return {
      entries,
      slugs: entries.map((e) => e.slug),
      count: entries.length,
      activeType: entries[0]?.type ?? null,
      ready,
      isComparing,
      toggleCompare,
      removeCompare,
      clearCompare,
    };
  }, [entries, ready, isComparing, toggleCompare, removeCompare, clearCompare]);

  return (
    <CompareContext.Provider value={value}>{children}</CompareContext.Provider>
  );
}

export function useCompare(): CompareContextValue {
  const ctx = useContext(CompareContext);
  if (!ctx) {
    throw new Error("useCompare must be used within a CompareProvider");
  }
  return ctx;
}
