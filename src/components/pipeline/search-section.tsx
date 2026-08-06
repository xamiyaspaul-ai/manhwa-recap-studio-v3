"use client";

import { useState, useCallback, useMemo, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Search, Loader2, Sparkles, ExternalLink, X, Clock, Bookmark, BookmarkCheck, ArrowUpDown, BookmarkCheckIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSectionObserver } from "@/hooks/use-section-observer";
import type { MangadexManga, MangaSource } from "@/types/pipeline";

interface SearchSectionProps {
  onResults: (manga: MangadexManga[], query: string) => void;
  onSelectManga: (manga: MangadexManga) => void;
  externalQuery?: string | null;
  onClearResults?: () => void;
  isBookmarked?: (mangaId: string) => boolean;
  onBookmarkToggle?: (manga: MangadexManga) => void;
}

export interface SearchSectionHandle {
  clearResults: () => void;
}

type SourceFilter = "all" | MangaSource;

const SOURCE_FILTERS: { value: SourceFilter; label: string; color: string }[] = [
  { value: "all", label: "All Sources", color: "" },
  { value: "mangahere", label: "MangaHere", color: "text-emerald-400" },
  { value: "fanfox", label: "FanFox", color: "text-orange-400" },
  { value: "webtoons", label: "Webtoons", color: "text-green-400" },
  { value: "asurascans", label: "AsuraScans", color: "text-rose-400" },
  { value: "mal", label: "MAL", color: "text-sky-400" },
  { value: "anilist", label: "AniList", color: "text-fuchsia-400" },
];

const SOURCE_BADGE_CLASSES: Record<MangaSource, string> = {
  mangahere: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  fanfox: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  webtoons: "bg-green-500/15 text-green-300 border-green-500/30",
  asurascans: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  mal: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  anilist: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
};

const SOURCE_LABEL: Record<MangaSource, string> = {
  mangahere: "MangaHere",
  fanfox: "FanFox",
  webtoons: "Webtoons",
  asurascans: "Asura",
  mal: "MAL",
  anilist: "AniList",
};

const CONTENT_RATING_CLASSES: Record<string, string> = {
  safe: "bg-emerald-500",
  suggestive: "bg-amber-500",
};

const CONTENT_RATING_LABEL: Record<string, string> = {
  safe: "Safe",
  suggestive: "Suggestive",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  ongoing: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  completed: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  hiatus: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  cancelled: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

const GENRE_ICONS: Record<string, string> = {
  "Action": "⚔️",
  "Adventure": "🗺️",
  "Fantasy": "🔮",
  "Romance": "💕",
  "Comedy": "😂",
  "Drama": "🎭",
  "Horror": "👻",
  "Sci-Fi": "🚀",
  "Slice of Life": "☕",
  "Mystery": "🔍",
  "Supernatural": "✨",
  "Thriller": "😱",
  "Martial Arts": "🥋",
  "Isekai": "🌀",
  "School Life": "📚",
};

interface SourceCounts {
  mangahere: number;
  fanfox: number;
  webtoons: number;
  asurascans: number;
  mal: number;
  anilist: number;
}

type SortOption = "relevance" | "title-az" | "title-za" | "year-desc" | "year-asc" | "chapters-desc";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "title-az", label: "Title A→Z" },
  { value: "title-za", label: "Title Z→A" },
  { value: "year-desc", label: "Newest" },
  { value: "year-asc", label: "Oldest" },
  { value: "chapters-desc", label: "Most Chapters" },
];

const SEARCH_HISTORY_KEY = "manhwa-search-history";
const MAX_HISTORY = 5;

function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setSearchHistory(items: string[]) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
  } catch {}
}

const SearchSection = forwardRef<SearchSectionHandle, SearchSectionProps>(
  function SearchSection({ onResults, onSelectManga, externalQuery, onClearResults, isBookmarked, onBookmarkToggle }, ref) {
    const { toast } = useToast();
    const { ref: sectionRef, isVisible } = useSectionObserver(0.05);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [resolvingId, setResolvingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<MangadexManga[]>([]);
    const [sourceCounts, setSourceCounts] = useState<SourceCounts | null>(null);
    const [filter, setFilter] = useState<SourceFilter>("all");
    const [sortBy, setSortBy] = useState<SortOption>("relevance");
    const [hasSearched, setHasSearched] = useState(false);
    const [searchDuration, setSearchDuration] = useState<number | null>(null);
    const [inputFocused, setInputFocused] = useState(false);
    const [searchHistory, setSearchHistoryState] = useState<string[]>([]);
    const [poppedBookmark, setPoppedBookmark] = useState<string | null>(null);
    const searchStartTime = useRef<number>(0);

    useEffect(() => {
      setSearchHistoryState(getSearchHistory());
    }, []);

    useImperativeHandle(ref, () => ({
      clearResults: () => {
        setResults([]);
        setSourceCounts(null);
        setHasSearched(false);
        setQuery("");
        setError(null);
        setFilter("all");
        setSortBy("relevance");
        setSearchDuration(null);
        onClearResults?.();
      },
    }), [onClearResults]);

    useEffect(() => {
      if (externalQuery) {
        setQuery(externalQuery);
        setTimeout(() => {
          const form = document.querySelector<HTMLFormElement>('form');
          if (form) form.requestSubmit();
        }, 100);
      }
    }, [externalQuery]);

    const addToHistory = useCallback((q: string) => {
      const trimmed = q.trim();
      if (!trimmed) return;
      setSearchHistoryState((prev) => {
        const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
        const next = [trimmed, ...filtered].slice(0, MAX_HISTORY);
        setSearchHistory(next);
        return next;
      });
    }, []);

    const removeFromHistory = useCallback((item: string) => {
      setSearchHistoryState((prev) => {
        const next = prev.filter((h) => h !== item);
        setSearchHistory(next);
        return next;
      });
    }, []);

    const clearHistory = useCallback(() => {
      setSearchHistoryState([]);
      setSearchHistory([]);
    }, []);

    const handleClearResults = useCallback(() => {
      setResults([]);
      setSourceCounts(null);
      setHasSearched(false);
      setQuery("");
      setError(null);
      setFilter("all");
      setSortBy("relevance");
      setSearchDuration(null);
      onClearResults?.();
    }, [onClearResults]);

    const handleSearch = useCallback(async () => {
      const q = query.trim();
      if (!q) return;
      setLoading(true);
      setError(null);
      setHasSearched(true);
      searchStartTime.current = performance.now();

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=24`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const elapsed = Math.round(((performance.now() - searchStartTime.current) / 1000) * 10) / 10;
        setSearchDuration(elapsed);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Search failed (${res.status})`);
        }
        const data = await res.json();
        const manga: MangadexManga[] = data.manga ?? [];
        setResults(manga);
        setSourceCounts(data.sources ?? null);
        onResults(manga, q);
        addToHistory(q);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Search failed";
        if (e instanceof DOMException && e.name === "AbortError") {
          setError("Search timed out. Some sources may be slow — try again.");
        } else {
          setError(msg);
        }
        setResults([]);
        setSourceCounts(null);
        setSearchDuration(null);
      } finally {
        setLoading(false);
      }
    }, [query, onResults, addToHistory]);

    const visibleResults = useMemo(() => {
      let filtered = filter === "all" ? results : results.filter((m) => (m.source ?? "mangahere") === filter);
      if (sortBy === "relevance") return filtered;
      const sorted = [...filtered];
      switch (sortBy) {
        case "title-az":
          sorted.sort((a, b) => a.title.localeCompare(b.title));
          break;
        case "title-za":
          sorted.sort((a, b) => b.title.localeCompare(a.title));
          break;
        case "year-desc":
          sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
          break;
        case "year-asc":
          sorted.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
          break;
        case "chapters-desc":
          sorted.sort((a, b) => (b.lastChapter ?? 0) - (a.lastChapter ?? 0));
          break;
      }
      return sorted;
    }, [results, filter, sortBy]);

    const activeSourceCount = useMemo(() => {
      if (!sourceCounts) return 0;
      return Object.values(sourceCounts).filter((c) => c > 0).length;
    }, [sourceCounts]);

    const handleSelect = useCallback(
      async (m: MangadexManga) => {
        const source = m.source ?? "mangahere";
        if (source === "mangahere" || source === "fanfox" || source === "webtoons" || source === "asurascans") {
          onSelectManga(m);
          return;
        }

        setResolvingId(m.id);
        const findingToast = toast({
          title: "Resolving on MangaHere",
          description: `Finding on MangaHere…`,
        });

        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(m.title)}&limit=1&source=mangahere`);
          const data = await res.json().catch(() => ({}));
          const mdMatch: MangadexManga | undefined = (data.manga ?? [])[0];

          if (!res.ok || !mdMatch) {
            findingToast.update({
              id: findingToast.id,
              title: "Not found on MangaHere",
              description: `Could not find on MangaHere for scraping.`,
              variant: "destructive",
            });
            return;
          }

          findingToast.update({
            id: findingToast.id,
            title: "Matched on MangaHere",
            description: `Using "${mdMatch.title}" for scraping.`,
          });
          onSelectManga({
            ...mdMatch,
            externalUrl: mdMatch.externalUrl ?? m.externalUrl ?? null,
          });
        } catch {
          findingToast.update({
            id: findingToast.id,
            title: "Resolution failed",
            description: `Could not find on MangaHere for scraping.`,
            variant: "destructive",
          });
        } finally {
          setResolvingId(null);
        }
      },
      [onSelectManga, toast]
    );

    const handleBookmark = useCallback((e: React.MouseEvent, m: MangadexManga) => {
      e.stopPropagation();
      const wasBookmarked = isBookmarked?.(m.id) ?? false;
      onBookmarkToggle?.(m);
      setPoppedBookmark(m.id);
      setTimeout(() => setPoppedBookmark(null), 350);
      toast({
        title: wasBookmarked ? "Bookmark removed" : "Bookmarked!",
        description: wasBookmarked ? `Removed "${m.title}" from saved manga` : `Saved "${m.title}" to bookmarks`,
      });
    }, [onBookmarkToggle, isBookmarked, toast]);

    const showHistory = inputFocused && query === "" && searchHistory.length > 0 && !hasSearched;

    return (
      <section ref={sectionRef} className="space-y-6">
        {/* Hero with glow orbs */}
        <div className="relative">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="hidden sm:block absolute -top-20 left-1/4 w-[300px] h-[300px] rounded-full blur-[100px] opacity-10"
              style={{
                background: "radial-gradient(circle, oklch(0.78 0.17 65), oklch(0.72 0.18 45 / 0.3), transparent)",
                animation: "float-orb-1 8s ease-in-out infinite",
              }}
            />
            <div
              className="hidden sm:block absolute -top-10 right-1/4 w-[250px] h-[250px] rounded-full blur-[80px] opacity-[0.08]"
              style={{
                background: "radial-gradient(circle, oklch(0.72 0.18 45), oklch(0.78 0.17 65 / 0.2), transparent)",
                animation: "float-orb-2 12s ease-in-out infinite",
              }}
            />
            <div
              className="hidden sm:block absolute top-10 left-1/2 -translate-x-1/2 w-[200px] h-[200px] rounded-full blur-[90px] opacity-[0.06]"
              style={{
                background: "radial-gradient(circle, oklch(0.85 0.12 75), oklch(0.78 0.17 65 / 0.2), transparent)",
                animation: "float-orb-3 15s ease-in-out infinite",
              }}
            />
          </div>

          <div className={`relative text-center space-y-5 transition-all duration-700 ${isVisible ? "animate-section-in" : "opacity-0"}`}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">AI-Powered Video Pipeline</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
              <span className="text-gradient">Manhwa Recap</span>
              <br />
              <span className="text-gradient">Studio</span>
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
              Enter any manhwa, manga, or webtoon name. We search{" "}
              <span className="text-foreground font-medium">6 sources at once</span>,
              scrape every chapter, transcribe dialogue with AI, and render a narrated recap video.
            </p>
            <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground/50">
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-foreground/70 font-mono text-[10px] hover:bg-muted/80 transition-colors cursor-default">/</kbd>
                <span>focus</span>
              </div>
              <span className="text-muted-foreground/20">·</span>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-foreground/70 font-mono text-[10px] hover:bg-muted/80 transition-colors cursor-default">Esc</kbd>
                <span>clear</span>
              </div>
              <span className="text-muted-foreground/20">·</span>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-foreground/70 font-mono text-[10px] hover:bg-muted/80 transition-colors cursor-default">B</kbd>
                <span>bookmarks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Glassmorphism search bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              id="search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setTimeout(() => setInputFocused(false), 200)}
              placeholder="e.g. Solo Leveling, Tower of God, One Piece…"
              className="pl-11 h-13 text-base bg-card/80 border-border/80 backdrop-blur-sm focus:bg-card transition-all shadow-sm focus:shadow-md focus:shadow-primary/5 rounded-xl"
              autoFocus
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="h-13 px-8 font-semibold rounded-xl shadow-sm hover:shadow-md hover:shadow-primary/10 transition-all"
            disabled={loading || !query.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Searching…
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" />
                Search
              </>
            )}
          </Button>
        </form>

        {/* Search history chips */}
        {showHistory && (
          <div className="max-w-2xl mx-auto space-y-2 animate-fade-in-up">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground/60" />
              <span className="text-[11px] text-muted-foreground/60 font-medium">Recent searches</span>
              <button
                type="button"
                onClick={clearHistory}
                className="ml-auto text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                Clear history
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {searchHistory.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setQuery(item);
                    const input = document.getElementById("search-input") as HTMLInputElement | null;
                    if (input) input.focus();
                  }}
                  className="group flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-border bg-card/50 text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all"
                >
                  <span>{item}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFromHistory(item);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-rose-400 transition-all"
                    aria-label={`Remove "${item}" from history`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="max-w-2xl mx-auto">
            <p className="text-center text-destructive text-sm bg-destructive/10 border border-destructive/20 rounded-lg py-2 px-4">{error}</p>
          </div>
        )}

        {/* Source filter row + sort + counts + clear results button */}
        {hasSearched && !loading && results.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 animate-fade-in-up">
            {SOURCE_FILTERS.map((f) => {
              const isActive = filter === f.value;
              const count =
                f.value === "all"
                  ? results.length
                  : sourceCounts
                    ? sourceCounts[f.value]
                    : results.filter((m) => (m.source ?? "mangahere") === f.value).length;
              return (
                <Button
                  key={f.value}
                  type="button"
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => setFilter(f.value)}
                  className={`h-8 px-3 text-xs rounded-lg ${!isActive && f.color ? `hover:${f.color} hover:border-current/30` : ""}`}
                >
                  {f.label}
                  <span
                    className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-mono ${
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </Button>
              );
            })}
            {/* Sort dropdown */}
            <div className="flex items-center gap-1">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/60" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="h-8 px-2 text-xs bg-muted/50 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer pr-6 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22currentColor%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_6px_center] bg-no-repeat"
                aria-label="Sort results"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleClearResults}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          </div>
        )}

        {/* Result count summary */}
        {hasSearched && !loading && results.length > 0 && (
          <p className="text-center text-xs text-muted-foreground animate-fade-in-up">
            Found{" "}
            <span className="text-foreground font-semibold">{visibleResults.length}</span>{" "}
            result{visibleResults.length !== 1 ? "s" : ""} from{" "}
            <span className="text-foreground font-semibold">{activeSourceCount}</span>{" "}
            source{activeSourceCount !== 1 ? "s" : ""}
            {searchDuration !== null && (
              <> in{" "}
                <span className="text-foreground font-semibold">{searchDuration}s</span>
              </>
            )}
          </p>
        )}

        {hasSearched && !loading && visibleResults.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3 animate-fade-in-up">
            <div className="p-4 rounded-full bg-muted/50 border border-border">
              <Search className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                {results.length === 0
                  ? "No results found"
                  : `No results from ${SOURCE_FILTERS.find((f) => f.value === filter)?.label}`}
              </p>
              <p className="text-xs text-muted-foreground/60">
                {results.length === 0
                  ? "Try a different title, spelling, or browse trending picks above."
                  : "Try selecting a different source filter."}
              </p>
            </div>
          </div>
        )}

        {visibleResults.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {visibleResults.map((m, idx) => {
              const source = m.source ?? "mangahere";
              const isResolving = resolvingId === m.id;
              const isExternal = source === "mal" || source === "anilist";
              const contentRating = m.contentRating ?? "safe";
              const mangaStatus = m.status?.toLowerCase() ?? null;
              const bookmarked = isBookmarked?.(m.id) ?? false;
              const isPopped = poppedBookmark === m.id;

              // Pick first 2 genre tags
              const genreTags = (m.tags ?? []).slice(0, 2);

              return (
                <div
                  key={m.id}
                  onClick={() => !isResolving && handleSelect(m)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && !isResolving) {
                      e.preventDefault();
                      handleSelect(m);
                    }
                  }}
                  className="group text-left space-y-2 transition-all duration-300 hover:scale-[1.03] hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-ring rounded-lg disabled:opacity-60 disabled:hover:scale-100 cursor-pointer animate-item-in"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-muted border border-border relative group-hover:border-primary/40 group-hover:shadow-lg group-hover:shadow-primary/5 transition-all duration-300">
                    {m.coverUrl ? (
                      <img
                        src={m.coverUrl}
                        alt={m.title}
                        className="w-full h-full object-cover group-hover:scale-110 group-hover:brightness-110 transition-all duration-500"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-2 text-center gap-1">
                        <Search className="h-6 w-6 opacity-30" />
                        <span className="text-xs">No cover</span>
                      </div>
                    )}
                    {/* Source badge */}
                    <span
                      className={`absolute top-1.5 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border backdrop-blur-sm ${SOURCE_BADGE_CLASSES[source]}`}
                    >
                      {isResolving ? "…" : SOURCE_LABEL[source]}
                    </span>
                    {/* Content rating dot */}
                    <span
                      className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${CONTENT_RATING_CLASSES[contentRating] ?? "bg-emerald-500"}`}
                      title={CONTENT_RATING_LABEL[contentRating] ?? contentRating}
                    />
                    {/* Bookmark button */}
                    <button
                      type="button"
                      onClick={(e) => handleBookmark(e, m)}
                      className={`absolute bottom-1.5 right-1.5 p-1.5 rounded-lg bg-black/50 backdrop-blur-sm text-white/70 hover:text-primary hover:bg-black/70 transition-all z-10 ${bookmarked ? "text-primary" : "opacity-0 group-hover:opacity-100"} ${isPopped ? "animate-bookmark-pop" : ""}`}
                      aria-label={bookmarked ? `Remove ${m.title} from bookmarks` : `Bookmark ${m.title}`}
                    >
                      {bookmarked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                    </button>
                    {/* External link hint */}
                    {isExternal && m.externalUrl && (
                      <a
                        href={m.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-1.5 right-1.5 p-1 rounded bg-black/50 text-white/80 hover:text-white hover:bg-black/70 transition z-10"
                        aria-label={`View ${SOURCE_LABEL[source]} page`}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-end justify-between p-2">
                      {/* Genre tags at top */}
                      <div className="flex flex-wrap gap-1 justify-end">
                        {genreTags.map((tag) => (
                          <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-md bg-black/40 backdrop-blur-sm text-white/80 border border-white/10">
                            {GENRE_ICONS[tag] ?? ""} {tag}
                          </span>
                        ))}
                      </div>
                      <span className="text-white text-xs font-medium">
                        {isResolving
                          ? "Finding on MangaHere…"
                          : isExternal
                            ? "Match on MangaDex →"
                            : "Select →"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                      {m.title}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs text-muted-foreground">
                        {m.year ? `${m.year}` : ""}
                        {m.year && m.originalLanguage ? " · " : ""}
                        {m.originalLanguage?.toUpperCase() ?? (isExternal ? SOURCE_LABEL[source] : "?")}
                        {m.lastChapter ? ` · Ch.${m.lastChapter}` : ""}
                      </p>
                    </div>
                    {mangaStatus && STATUS_BADGE_CLASSES[mangaStatus] && (
                      <span
                        className={`inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-md border ${STATUS_BADGE_CLASSES[mangaStatus]}`}
                      >
                        {mangaStatus.charAt(0).toUpperCase() + mangaStatus.slice(1)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasSearched && !loading && results.length > 0 && (
          <p className="text-center text-xs text-muted-foreground/60">
            {sourceCounts
              ? `MangaHere: ${sourceCounts.mangahere} · FanFox: ${sourceCounts.fanfox} · Webtoons: ${sourceCounts.webtoons} · AsuraScans: ${sourceCounts.asurascans} · MAL: ${sourceCounts.mal} · AniList: ${sourceCounts.anilist}`
              : ""}{" "}
            — metadata-only results (MAL/AniList) are auto-matched to a scrapeable source on selection.
          </p>
        )}
      </section>
    );
  }
);

export { SearchSection };
