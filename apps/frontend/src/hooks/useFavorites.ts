import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "faztudo_favorites";

function loadFavorites(): number[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((id): id is number => typeof id === "number");
      }
    }
  } catch {
    // Corrupted data - reset
  }
  return [];
}

function saveFavorites(ids: number[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage full or unavailable
  }
}

/**
 * Hook to manage service favorites with localStorage persistence.
 * Returns isFavorite check and toggle function.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<number[]>(loadFavorites);

  // Sync across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setFavorites(loadFavorites());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const isFavorite = useCallback(
    (serviceId: number) => favorites.includes(serviceId),
    [favorites],
  );

  const toggleFavorite = useCallback((serviceId: number) => {
    setFavorites((prev) => {
      const next = prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId];
      saveFavorites(next);
      return next;
    });
  }, []);

  return { isFavorite, toggleFavorite, favorites };
}
