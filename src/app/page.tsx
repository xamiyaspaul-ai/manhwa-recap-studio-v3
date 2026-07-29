"use client";

import { useState, useCallback, useEffect } from "react";
import { Github, Zap } from "lucide-react";
import { SearchSection } from "@/components/pipeline/search-section";
import { MangaConfig } from "@/components/pipeline/manga-config";
import { JobProgress } from "@/components/pipeline/job-progress";
import { JobHistory } from "@/components/pipeline/job-history";
import { HowItWorks } from "@/components/pipeline/how-it-works";
import { StatsBar } from "@/components/pipeline/stats-bar";
import { TrendingSearches } from "@/components/pipeline/trending-searches";
import { useJobProgress } from "@/hooks/use-job-progress";
import type { MangadexManga } from "@/types/pipeline";

type View = "search" | "config" | "job";

export default function Home() {
  const [view, setView] = useState<View>("search");
  const [selectedManga, setSelectedManga] = useState<MangadexManga | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);
  const [trendingQuery, setTrendingQuery] = useState<string | null>(null);

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

  // Keyboard shortcut: "/" focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && view === "search") {
        const input = document.getElementById("search-input") as HTMLInputElement | null;
        if (input) {
          e.preventDefault();
          input.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view]);

  return (
    <div className="min-h-screen flex flex-col bg-background bg-grain">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <button onClick={handleNewJob} className="flex items-center gap-2 group">
            <div className="p-1.5 rounded-md bg-primary/10 group-hover:bg-primary/20 transition">
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base">Manhwa Recap Studio</span>
              <span className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary/80 border border-primary/20">
                v3
              </span>
            </div>
          </button>
          <div className="flex items-center gap-3">
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
      <main className="flex-1 px-4 py-8 sm:py-12">
        {view === "search" && (
          <div className="space-y-10">
            <StatsBar />
            <SearchSection
              onResults={() => {}}
              onSelectManga={handleSelectManga}
              externalQuery={trendingQuery}
            />
            <TrendingSearches onPick={handleTrendingPick} />
            <HowItWorks />
            <JobHistory onSelectJob={handleSelectHistoryJob} refreshKey={historyRefresh} />
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

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-background/50">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
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
            <span className="text-muted-foreground/80">VLM · edge-tts · ffmpeg · YOLO</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/zainrana558/manhwa-recap-studio-v3"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition"
            >
              <Github className="h-3 w-3" />
              <span>GitHub</span>
            </a>
            <span className="text-muted-foreground/40">·</span>
            <span>For personal use only</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
