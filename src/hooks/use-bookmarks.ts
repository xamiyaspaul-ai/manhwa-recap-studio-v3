"use client";

import { useState, useCallback, useEffect } from "react";
import type { MangadexManga } from "@/types/pipeline";

const BOOKMARKS_KEY = "manhwa-studio-bookmarks";
const MAX_BOOKMARKS = 20;

export interface Bookmark {
  id: string;
  title: string;
  coverUrl: string | null;
  source: string;
  year: number | null;
  lastChapter: string | null;
  status: string | null;
  addedAt: number;
}

function toBookmark(m: MangadexManga): Bookmark {
  return {
    id: m.id,
    title: m.title,
    coverUrl: m.coverUrl,
    source: m.source ?? "mangahere",
    year: m.year,
    lastChapter: m.lastChapter,
    status: m.status,
    addedAt: Date.now(),
  };
}

function loadBookmarks(): Bookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveBookmarks(items: Bookmark[]) {
  try {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(items.slice(0, MAX_BOOKMARKS)));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    if (typeof window === "undefined") return [];
    return loadBookmarks();
  });

  const isBookmarked = useCallback(
    (mangaId: string) => bookmarks.some((b) => b.id === mangaId),
    [bookmarks]
  );

  const toggleBookmark = useCallback((manga: MangadexManga) => {
    setBookmarks((prev) => {
      const exists = prev.some((b) => b.id === manga.id);
      if (exists) {
        const next = prev.filter((b) => b.id !== manga.id);
        saveBookmarks(next);
        return next;
      }
      const next = [toBookmark(manga), ...prev].slice(0, MAX_BOOKMARKS);
      saveBookmarks(next);
      return next;
    });
  }, []);

  const removeBookmark = useCallback((mangaId: string) => {
    setBookmarks((prev) => {
      const next = prev.filter((b) => b.id !== mangaId);
      saveBookmarks(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setBookmarks([]);
    try { localStorage.removeItem(BOOKMARKS_KEY); } catch {}
  }, []);

  return { bookmarks, isBookmarked, toggleBookmark, removeBookmark, clearAll };
}
