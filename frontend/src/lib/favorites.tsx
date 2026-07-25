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
 * Client-only "Избранное" (favorites) store for the public catalog.
 *
 * There is no public-site auth, so favorites live entirely in localStorage
 * under a single key as a JSON array of property identifiers (we use the
 * property `slug`, which is what PropertyCard already receives and what the
 * detail API fetches by). A React context is the single source of truth so the
 * heart icons, the header count badge, and the /favorites page all stay in sync
 * within the session; a `storage` event listener keeps other tabs in sync too.
 */

export const FAVORITES_LS_KEY = "centreal_favorites";

function readFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Keep only non-empty strings; dedupe defensively.
    return Array.from(
      new Set(parsed.filter((x): x is string => typeof x === "string" && x.length > 0)),
    );
  } catch {
    return [];
  }
}

function writeToStorage(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FAVORITES_LS_KEY, JSON.stringify(ids));
  } catch {
    // Storage may be unavailable (private mode, quota) — fail silently; the
    // in-memory state still reflects the toggle for this session.
  }
}

interface FavoritesContextValue {
  /** Ordered list of favorited property ids (slugs), newest first. */
  favorites: string[];
  /** Number of favorites (for the header badge). */
  count: number;
  /** Whether the store has hydrated from localStorage (avoids SSR mismatch). */
  ready: boolean;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  addFavorite: (id: string) => void;
  removeFavorite: (id: string) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  // Start empty on both server and first client render (SSR-safe), then hydrate
  // from localStorage in an effect to avoid a hydration mismatch.
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setFavorites(readFromStorage());
    setReady(true);
  }, []);

  // Cross-tab sync: mirror the same pattern used by HeaderAccountControls.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === FAVORITES_LS_KEY || e.key === null) {
        setFavorites(readFromStorage());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addFavorite = useCallback(
    (id: string) => {
      if (!id) return;
      setFavorites((prev) => {
        if (prev.includes(id)) return prev;
        const next = [id, ...prev];
        writeToStorage(next);
        return next;
      });
    },
    [],
  );

  const removeFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      if (!prev.includes(id)) return prev;
      const next = prev.filter((x) => x !== id);
      writeToStorage(next);
      return next;
    });
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    if (!id) return;
    setFavorites((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [id, ...prev];
      writeToStorage(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (id: string) => favorites.includes(id),
    [favorites],
  );

  const value = useMemo<FavoritesContextValue>(
    () => ({
      favorites,
      count: favorites.length,
      ready,
      isFavorite,
      toggleFavorite,
      addFavorite,
      removeFavorite,
    }),
    [favorites, ready, isFavorite, toggleFavorite, addFavorite, removeFavorite],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return ctx;
}
