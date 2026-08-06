"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Search,
  Bookmark,
  Settings,
  Sun,
  Moon,
  Clock,
  TrendingUp,
  Workflow,
  Plus,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Command {
  id: string;
  label: string;
  desc: string;
  icon: LucideIcon;
}

const COMMANDS: Command[] = [
  { id: "search", label: "Search Manhwa", desc: "Focus the search bar", icon: Search },
  { id: "bookmarks", label: "Toggle Bookmarks", desc: "Show/hide bookmarked manga", icon: Bookmark },
  { id: "settings", label: "Open Settings", desc: "Configure API keys and preferences", icon: Settings },
  { id: "theme", label: "Toggle Theme", desc: "Switch between dark and light mode", icon: Sun },
  { id: "history", label: "View Job History", desc: "Scroll to job history section", icon: Clock },
  { id: "trending", label: "View Trending", desc: "Scroll to trending searches", icon: TrendingUp },
  { id: "how-it-works", label: "How It Works", desc: "View the pipeline steps", icon: Workflow },
  { id: "new-job", label: "New Job", desc: "Start a new recap job", icon: Plus },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onAction: (actionId: string) => void;
  isDark: boolean;
}

export function CommandPalette({ open, onClose, onAction, isDark }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [prevOpen, setPrevOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Render-time: reset when palette opens
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }

  const filtered = query
    ? COMMANDS.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.desc.toLowerCase().includes(query.toLowerCase())
      )
    : COMMANDS;

  // Sync selected index when filtered list shrinks
  const [prevFilteredLen, setPrevFilteredLen] = useState(filtered.length);
  if (filtered.length !== prevFilteredLen) {
    setPrevFilteredLen(filtered.length);
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(0);
    }
  }

  const safeIndex = selectedIndex >= filtered.length ? 0 : selectedIndex;

  // Focus input when opened
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter" && filtered[safeIndex]) {
        e.preventDefault();
        onAction(filtered[safeIndex].id);
        onClose();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, safeIndex, onAction, onClose]
  );

  if (!open) return null;

  const ThemeIcon = isDark ? Sun : Moon;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg mx-4 rounded-xl border border-border bg-popover shadow-2xl animate-fade-in-scale overflow-hidden">
        {/* Search input */}
        <div className="flex items-center border-b border-border px-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent py-3 px-2 text-sm outline-none placeholder:text-muted-foreground/50"
          />
        </div>

        {/* Command list */}
        <div className="max-h-72 overflow-y-auto scrollbar-thin p-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No matching commands
            </div>
          ) : (
            filtered.map((cmd, i) => {
              const Icon = cmd.id === "theme" ? ThemeIcon : cmd.icon;
              const isActive = i === safeIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={() => {
                    onAction(cmd.id);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    isActive
                      ? "bg-primary/10 border-l-2 border-primary"
                      : "border-l-2 border-transparent hover:bg-muted/50"
                  }`}
                >
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{cmd.label}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {cmd.desc}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-3 py-2 flex items-center justify-center gap-3 text-[10px] text-muted-foreground/50">
          <span>
            <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono text-[9px]">
              ↑↓
            </kbd>{" "}
            Navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono text-[9px]">
              Enter
            </kbd>{" "}
            Select
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono text-[9px]">
              Esc
            </kbd>{" "}
            Close
          </span>
        </div>
      </div>
    </div>
  );
}
