"use client";

import { useState, useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { Github, Zap, Keyboard, ChevronUp, Sun, Moon, Heart, Twitter, Bell } from "lucide-react";
import { useTheme } from "next-themes";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { SearchSection } from "@/components/pipeline/search-section";
import { MangaConfig } from "@/components/pipeline/manga-config";
import { JobProgress } from "@/components/pipeline/job-progress";
import { JobHistory } from "@/components/pipeline/job-history";
import { HowItWorks } from "@/components/pipeline/how-it-works";
import { StatsBar } from "@/components/pipeline/stats-bar";
import { TrendingSearches } from "@/components/pipeline/trending-searches";
import { FAQ } from "@/components/pipeline/faq";
import { ConnectionIndicator } from "@/components/pipeline/connection-indicator";
import { SettingsDialog } from "@/components/pipeline/settings-dialog";
import { FeaturesGrid } from "@/components/pipeline/features-grid";
import { BookmarksSection } from "@/components/pipeline/bookmarks-section";
import { OnboardingTour } from "@/components/pipeline/onboarding-tour";
import { Testimonials } from "@/components/pipeline/testimonials";
import { useJobProgress } from "@/hooks/use-job-progress";
import { useScrollProgress } from "@/hooks/use-section-observer";
import { useBookmarks } from "@/hooks/use-bookmarks";
import type { MangadexManga } from "@/types/pipeline";

type View = "search" | "config" | "job";

const SHORTCUTS = [
  { key: "/", desc: "Focus search" },
  { key: "Esc", desc: "Clear search results" },
  { key: "B", desc: "Toggle bookmarks" },
];

const TECH_BADGES = ["Next.js 16", "Tailwind CSS 4", "Prisma", "Framer Motion", "Socket.IO", "TypeScript"];

export default function Home() {
  const [view, setView] = useState<View>("search");
  const [selectedManga, setSelectedManga] = useState<MangadexManga | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [trendingQuery, setTrendingQuery] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const { theme, setTheme } = useTheme();
  const scrollProgress = useScrollProgress();
  const { isBookmarked, toggleBookmark } = useBookmarks();

  // Hydration-safe client-only check
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const mainRef = useRef<HTMLDivElement>(null);
  const searchSectionRef = useRef<{ clearResults: () => void } | null>(null);

  const { job, logs, connected } = useJobProgress(currentJobId);

  const handleSelectManga = useCallback((manga: MangadexManga) => {
    setSelectedManga(manga);
    setView("config");
  }, []);

  const handleJobCreated = useCallback((jobId: string) => {
    setCurrentJobId(jobId);
    setView("job");
    setHistoryRefresh((n) => n + 1);
  }, []);

  const handleNewJob = useCallback(() => {
    setCurrentJobId(null);
    setSelectedManga(null);
    setView("search");
    setHistoryRefresh((n) => n + 1);
  }, []);

  const handleSelectHistoryJob = useCallback((jobId: string) => {
    setCurrentJobId(jobId);
    setView("job");
  }, []);

  const handleTrendingPick = useCallback((query: string) => {
    setTrendingQuery(query);
  }, []);

  const handleClearResults = useCallback(() => {
    setTrendingQuery(null);
  }, []);

  const handleBookmarkToggle = useCallback((manga: MangadexManga) => {
    toggleBookmark(manga);
  }, [toggleBookmark]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable;

      if (e.key === "/" && view === "search" && !isTyping) {
        const input = document.getElementById("search-input") as HTMLInputElement | null;
        if (input) {
          e.preventDefault();
          input.focus();
        }
      }

      if (e.key === "Escape" && view === "search" && !isTyping) {
        searchSectionRef.current?.clearResults();
      }

      if (e.key === "b" && view === "search" && !isTyping) {
        e.preventDefault();
        setShowBookmarks((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view]);

  // Scroll detection for back-to-top
  useEffect(() => {
    const container = mainRef.current;
    if (!container) return;
    const handleScroll = () => {
      setShowScrollTop(container.scrollTop > 400);
    };
    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <div className="min-h-screen flex flex-col bg-background bg-grain">
      {/* Onboarding tour */}
      <OnboardingTour />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border glass">
        {/* Scroll progress bar */}
        <div className="absolute inset-x-0 top-0 h-[2px]">
          <div
            className="h-full transition-all duration-150 ease-out"
            style={{
              width: `${scrollProgress * 100}%`,
              background: "linear-gradient(90deg, oklch(0.78 0.17 65), oklch(0.72 0.18 45), oklch(0.85 0.15 75))",
              backgroundSize: "200% 100%",
              animation: "progress-shimmer 3s linear infinite",
            }}
          />
        </div>

        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <button onClick={handleNewJob} className="flex items-center gap-2.5 group">
            <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-all duration-300 group-hover:shadow-md group-hover:shadow-primary/10">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base">Manhwa Recap Studio</span>
              <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary/80 border border-primary/20">
                v3
              </span>
            </div>
          </button>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Connection indicator — only shown when not in search view */}
            {view !== "search" && <ConnectionIndicator connected={connected} />}

            {/* Settings dialog button */}
            <SettingsDialog />

            {/* Keyboard shortcut helper */}
            <Popover open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
              <PopoverTrigger asChild>
                <button
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  aria-label="Keyboard shortcuts"
                >
                  <Keyboard className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="w-64 p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Shortcuts
                </p>
                <div className="space-y-2">
                  {SHORTCUTS.map((s) => (
                    <div key={s.key} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground text-xs">{s.desc}</span>
                      <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-foreground/80 font-mono text-[10px]">
                        {s.key}
                      </kbd>
                    </div>
                  ))}
                </div>
                <div className="pt-1 border-t border-border">
                  <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
                    Bookmarks are saved locally. Press <kbd className="px-1 py-0.5 rounded border border-border bg-muted font-mono text-[9px]">B</kbd> to toggle.
                  </p>
                </div>
              </PopoverContent>
            </Popover>

            {/* Theme toggle */}
            {mounted && (
              <button
                onClick={toggleTheme}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-300"
                aria-label="Toggle theme"
              >
                <Sun
                  className={`h-4 w-4 transition-all duration-300 ${theme === "dark" ? "rotate-0 scale-100" : "rotate-90 scale-0 absolute"}`}
                />
                <Moon
                  className={`h-4 w-4 transition-all duration-300 ${theme === "dark" ? "-rotate-90 scale-0 absolute" : "rotate-0 scale-100"}`}
                />
              </button>
            )}

            <a
              href="https://github.com/zainrana558/manhwa-recap-studio-v3"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition"
              aria-label="Source"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Main */}
      <main ref={mainRef} className="flex-1 overflow-y-auto px-4 py-8 sm:py-12">
        {view === "search" && (
          <div className="space-y-12 max-w-6xl mx-auto">
            <StatsBar />
            <SearchSection
              ref={searchSectionRef}
              onResults={() => {}}
              onSelectManga={handleSelectManga}
              externalQuery={trendingQuery}
              onClearResults={handleClearResults}
              isBookmarked={isBookmarked}
              onBookmarkToggle={handleBookmarkToggle}
            />

            <Separator className="max-w-4xl mx-auto opacity-30" />

            {/* Bookmarks toggle + section */}
            {showBookmarks && (
              <BookmarksSection onSelectManga={handleSelectManga} />
            )}

            <TrendingSearches onPick={handleTrendingPick} />

            <Separator className="max-w-4xl mx-auto opacity-30" />

            <HowItWorks />

            <Separator className="max-w-4xl mx-auto opacity-30" />

            <FeaturesGrid />

            <Separator className="max-w-4xl mx-auto opacity-30" />

            <Testimonials />

            <Separator className="max-w-4xl mx-auto opacity-30" />

            <JobHistory onSelectJob={handleSelectHistoryJob} refreshKey={historyRefresh} />

            <Separator className="max-w-4xl mx-auto opacity-30" />

            <FAQ />
          </div>
        )}

        {view === "config" && selectedManga && (
          <MangaConfig
            manga={selectedManga}
            onBack={handleNewJob}
            onJobCreated={handleJobCreated}
          />
        )}

        {view === "job" && (
          <JobProgress
            job={job}
            logs={logs}
            connected={connected}
            onCancel={handleNewJob}
            onNewJob={handleNewJob}
          />
        )}
      </main>

      {/* Back to top floating button */}
      <div
        className={`fixed bottom-20 right-6 z-30 transition-all duration-300 ${showScrollTop && view === "search" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}
      >
        <button
          onClick={scrollToTop}
          className="p-2.5 rounded-full bg-primary/90 text-primary-foreground shadow-lg hover:bg-primary hover:shadow-xl hover:shadow-primary/20 transition-all active:scale-95"
          aria-label="Back to top"
        >
          <ChevronUp className="h-5 w-5" />
        </button>
      </div>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-background/50">
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-5">
          {/* Brand section */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <span className="font-bold text-sm">Manhwa Recap Studio</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary/80 border border-primary/20">
                v3
              </span>
            </div>

            {/* Social links */}
            <div className="flex items-center gap-3">
              <a
                href="https://github.com/zainrana558/manhwa-recap-studio-v3"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
                aria-label="GitHub"
              >
                <Github className="h-4 w-4" />
              </a>
              <span className="text-muted-foreground/30">|</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                Built with <Heart className="h-3 w-3 text-rose-400 inline" /> for manhwa fans
              </span>
            </div>
          </div>

          <Separator className="opacity-30" />

          {/* Technology badges */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {TECH_BADGES.map((badge) => (
              <span
                key={badge}
                className="bg-card border border-border rounded-full px-2.5 py-0.5 text-[10px] text-muted-foreground font-medium hover:border-primary/30 hover:text-foreground transition-colors cursor-default"
              >
                {badge}
              </span>
            ))}
          </div>

          <Separator className="opacity-20" />

          {/* Bottom links */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground/60">Powered by</span>
              <a href="https://asurascans.com" target="_blank" rel="noopener noreferrer" className="text-foreground/80 hover:text-primary transition">
                AsuraScans
              </a>
              <span className="text-muted-foreground/40">·</span>
              <a href="https://groq.com" target="_blank" rel="noopener noreferrer" className="text-foreground/80 hover:text-primary transition">
                Groq
              </a>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-foreground/80">VLM · edge-tts · ffmpeg · YOLO</span>
            </div>
            <div className="flex items-center gap-3">
              <span>For personal use only</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
