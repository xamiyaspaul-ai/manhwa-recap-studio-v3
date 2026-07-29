"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Search, Loader2, Sparkles, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { MangadexManga, MangaSource } from "@/types/pipeline";

interface SearchSectionProps {
  onResults: (manga: MangadexManga[], query: string) => void;
  onSelectManga: (manga: MangadexManga) => void;
  externalQuery?: string | null;
}

type SourceFilter = "all" | MangaSource;

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "All Sources" },
  { value: "mangahere", label: "MangaHere" },
  { value: "fanfox", label: "FanFox" },
  { value: "webtoons", label: "Webtoons" },
  { value: "asurascans", label: "AsuraScans" },
  { value: "mal", label: "MAL" },
  { value: "anilist", label: "AniList" },
];

/** Tailwind class strings for each source badge (used in result cards). */
const SOURCE_BADGE_CLASSES: Record<MangaSource, string> = {
  mangahere:
    "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  fanfox:
    "bg-orange-500/15 text-orange-300 border-orange-500/30",
  webtoons:
    "bg-green-500/15 text-green-300 border-green-500/30",
  asurascans:
    "bg-rose-500/15 text-rose-300 border-rose-500/30",
  mal: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  anilist:
    "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
};

const SOURCE_LABEL: Record<MangaSource, string> = {
  mangahere: "MangaHere",
  fanfox: "FanFox",
  webtoons: "Webtoons",
  asurascans: "Asura",
  mal: "MAL",
  anilist: "AniList",
};

interface SourceCounts {
  mangahere: number;
  fanfox: number;
  webtoons: number;
  asurascans: number;
  mal: number;
  anilist: number;
}

export function SearchSection({ onResults, onSelectManga, externalQuery }: SearchSectionProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // When a trending pick is clicked, fill the search box and auto-search
  useEffect(() => {
    if (externalQuery) {
      setQuery(externalQuery);
      // Trigger search automatically after state updates
      setTimeout(() => {
        const form = document.querySelector<HTMLFormElement>('form');
        if (form) form.requestSubmit();
      }, 100);
    }
  }, [externalQuery]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<MangadexManga[]>([]);
  const [sourceCounts, setSourceCounts] = useState<SourceCounts | null>(null);
  const [filter, setFilter] = useState<SourceFilter>("all");
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setHasSearched(true);

    // Single attempt with a client-side timeout. The API route already
    // queries all 6 sources in parallel with per-source 5s timeouts, so the
    // total response time is bounded. We add a 20s client-side timeout as a
    // safety net so the button never stays loading forever.
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=24`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Search failed (${res.status})`);
      }
      const data = await res.json();
      const manga: MangadexManga[] = data.manga ?? [];
      setResults(manga);
      setSourceCounts(data.sources ?? null);
      onResults(manga, q);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Search failed";
      // If aborted by our timeout, show a friendly message
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("Search timed out. Some sources may be slow — try again.");
      } else {
        setError(msg);
      }
      setResults([]);
      setSourceCounts(null);
    } finally {
      setLoading(false);
    }
  }, [query, onResults]);

  // Filtered view of results based on the source filter toggle.
  const visibleResults = useMemo(() => {
    if (filter === "all") return results;
    return results.filter((m) => (m.source ?? "mangahere") === filter);
  }, [results, filter]);

  /**
   * When a user selects a scrapeable result (MangaHere, FanFox, Webtoons),
   * proceed straight to the config page. For metadata-only results (MAL/AniList),
   * we re-search MangaHere by title to find the scrapeable version.
   */
  const handleSelect = useCallback(
    async (m: MangadexManga) => {
      const source = m.source ?? "mangahere";
      // All 4 scraping sources are directly usable.
      if (
        source === "mangahere" ||
        source === "fanfox" ||
        source === "webtoons" ||
        source === "asurascans"
      ) {
        onSelectManga(m);
        return;
      }

      // Metadata-only sources (MAL/AniList): resolve to a MangaHere manga first.
      setResolvingId(m.id);
      const findingToast = toast({
        title: "Resolving on MangaHere",
        description: `Finding on MangaHere…`,
      });

      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(m.title)}&limit=1&source=mangahere`
        );
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
        // Preserve the external source link on the resolved MangaHere manga
        // so the config page can show a "View on {source}" link if desired.
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

  return (
    <section className="space-y-6">
      <div className="text-center space-y-3">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          <span className="text-gradient">Manhwa Recap Studio</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Enter any manhwa, manga, or webtoon name. We search{" "}
          <span className="text-foreground font-medium">MangaHere, FanFox, Webtoons, AsuraScans, MyAnimeList &amp; AniList</span> at once,
          scrape every single chapter, translate to English, and render a narrated recap video.
        </p>
        <p className="text-xs text-muted-foreground/60">
          Press <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-foreground/80 font-mono text-[10px]">/</kbd> to focus search
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearch();
        }}
        className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            id="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Solo Leveling, Tower of God, One Piece…"
            className="pl-10 h-12 text-base bg-card border-border"
            autoFocus
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="h-12 px-8 font-semibold"
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

      {error && (
        <p className="text-center text-destructive text-sm">{error}</p>
      )}

      {/* Source filter row + counts */}
      {hasSearched && !loading && results.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
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
                className="h-8 px-3 text-xs"
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
        </div>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {visibleResults.map((m, idx) => {
            const source = m.source ?? "mangahere";
            const isResolving = resolvingId === m.id;
            const isExternal = source === "mal" || source === "anilist";
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
                className="group text-left space-y-2 transition-all duration-300 hover:scale-[1.05] hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-ring rounded-lg disabled:opacity-60 disabled:hover:scale-100 cursor-pointer animate-fade-in-up"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="aspect-[3/4] rounded-lg overflow-hidden bg-muted border border-border relative group-hover:border-primary/40 transition-colors">
                  {m.coverUrl ? (
                    <img
                      src={m.coverUrl}
                      alt={m.title}
                      className="w-full h-full object-cover group-hover:scale-105 group-hover:brightness-110 transition-all duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-2 text-center gap-1">
                      <Search className="h-6 w-6 opacity-30" />
                      <span className="text-xs">No cover</span>
                    </div>
                  )}
                  {/* Source badge (top-left) */}
                  <span
                    className={`absolute top-1.5 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border backdrop-blur-sm ${SOURCE_BADGE_CLASSES[source]}`}
                  >
                    {isResolving ? "…" : SOURCE_LABEL[source]}
                  </span>
                  {/* External link hint (top-right) for non-MangaHere sources */}
                  {isExternal && m.externalUrl && (
                    <a
                      href={m.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-1.5 right-1.5 p-1 rounded bg-black/50 text-white/80 hover:text-white hover:bg-black/70 transition z-10"
                      aria-label={`View ${SOURCE_LABEL[source]} page (opens new tab)`}
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-end p-2">
                    <span className="text-white text-xs font-medium">
                      {isResolving
                        ? "Finding on MangaDex…"
                        : isExternal
                          ? "Match on MangaDex →"
                          : "Select →"}
                    </span>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                    {m.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.year ? `${m.year} · ` : ""}
                    {m.originalLanguage?.toUpperCase() ?? (isExternal ? SOURCE_LABEL[source] : "?")}
                    {m.lastChapter ? ` · Ch.${m.lastChapter}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasSearched && !loading && results.length > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          {sourceCounts
            ? `MangaHere: ${sourceCounts.mangahere} · FanFox: ${sourceCounts.fanfox} · Webtoons: ${sourceCounts.webtoons} · AsuraScans: ${sourceCounts.asurascans} · MAL: ${sourceCounts.mal} · AniList: ${sourceCounts.anilist} — metadata-only results (MAL/AniList) are auto-matched to a scrapeable source on selection.`
            : "Metadata-only results (MAL/AniList) are auto-matched to a scrapeable source on selection."}
        </p>
      )}
    </section>
  );
}
