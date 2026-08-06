"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY = "mrs-recently-viewed";
const MAX_ITEMS = 20;

export interface RecentManga {
  id: string;
  title: string;
  coverUrl: string;
  viewedAt: number;
}

function loadItems(): RecentManga[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveItems(items: RecentManga[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function useRecentlyViewed() {
  const [recentlyViewed, setRecentlyViewed] = useState<RecentManga[]>(() => {
    if (typeof window === "undefined") return [];
    return loadItems().sort((a, b) => b.viewedAt - a.viewedAt);
  });

  const addViewed = useCallback(
    (manga: { id: string; title: string; coverUrl: string }) => {
      setRecentlyViewed((prev) => {
        const filtered = prev.filter((item) => item.id !== manga.id);
        const next = [
          { ...manga, viewedAt: Date.now() },
          ...filtered,
        ].slice(0, MAX_ITEMS);
        saveItems(next);
        return next;
      });
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    setRecentlyViewed((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveItems(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setRecentlyViewed([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { recentlyViewed, addViewed, removeItem, clearAll };
}
