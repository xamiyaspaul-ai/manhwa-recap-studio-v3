"use client";

import { useState, useCallback, useSyncExternalStore } from "react";

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  resultCount: number;
}

const STORAGE_KEY = "mrs-search-history";
const MAX_HISTORY = 15;

function getStoredHistory(): SearchHistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function setStoredHistory(items: SearchHistoryItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch {
    // ignore
  }
}

export function useSearchHistory() {
  const [history, setHistory] = useState<SearchHistoryItem[]>(getStoredHistory);

  const addHistory = useCallback((query: string, resultCount: number) => {
    if (!query.trim()) return;
    setHistory((prev) => {
      const filtered = prev.filter((h) => h.query.toLowerCase() !== query.toLowerCase());
      const updated = [
        { query: query.trim(), timestamp: Date.now(), resultCount },
        ...filtered,
      ].slice(0, MAX_HISTORY);
      setStoredHistory(updated);
      return updated;
    });
  }, []);

  const removeHistory = useCallback((query: string) => {
    setHistory((prev) => {
      const updated = prev.filter((h) => h.query !== query);
      setStoredHistory(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { history, addHistory, removeHistory, clearHistory };
}