"use client";

import { CheckCircle2, Loader2, AlertCircle, Clock, Image as ImageIcon, FileText, Film } from "lucide-react";
import type { ChapterInfo } from "@/types/pipeline";
import { cn } from "@/lib/utils";

interface ChapterGridProps {
  chapters: ChapterInfo[];
  jobId: string;
}

type CellStatus = "pending" | "scraping" | "scraped" | "transcribing" | "transcribed" | "rendering" | "rendered" | "error" | "done";

function getCellStatus(c: ChapterInfo): CellStatus {
  if (c.status === "error") return "error";
  if (c.status === "done" || c.rendered) return "rendered";
  if (c.status === "rendering") return "rendering";
  if (c.transcribed || c.status === "transcribed") return "transcribed";
  if (c.status === "transcribing") return "transcribing";
  if (c.status === "scraped") return "scraped";
  if (c.status === "scraping") return "scraping";
  return "pending";
}

const statusConfig: Record<CellStatus, { color: string; icon: typeof Clock; label: string }> = {
  pending: { color: "bg-muted text-muted-foreground border-border", icon: Clock, label: "Pending" },
  scraping: { color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: Loader2, label: "Scraping" },
  scraped: { color: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: ImageIcon, label: "Scraped" },
  transcribing: { color: "bg-orange-500/15 text-orange-400 border-orange-500/30", icon: Loader2, label: "Transcribing" },
  transcribed: { color: "bg-orange-500/15 text-orange-400 border-orange-500/30", icon: FileText, label: "Transcribed" },
  rendering: { color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: Loader2, label: "Rendering" },
  rendered: { color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: Film, label: "Rendered" },
  error: { color: "bg-rose-500/15 text-rose-400 border-rose-500/30", icon: AlertCircle, label: "Error" },
  done: { color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", icon: CheckCircle2, label: "Done" },
};

const LEGEND_ITEMS = [
  { status: "pending" as CellStatus, label: "Pending" },
  { status: "scraping" as CellStatus, label: "Scraping" },
  { status: "scraped" as CellStatus, label: "Scraped" },
  { status: "transcribing" as CellStatus, label: "Transcribing" },
  { status: "transcribed" as CellStatus, label: "Transcribed" },
  { status: "rendering" as CellStatus, label: "Rendering" },
  { status: "rendered" as CellStatus, label: "Rendered" },
  { status: "error" as CellStatus, label: "Error" },
];

export function ChapterGrid({ chapters, jobId }: ChapterGridProps) {
  if (chapters.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No chapters yet.</p>
    );
  }

  const processedCount = chapters.filter((c) => c.rendered || c.transcribed || c.status === "scraped").length;

  return (
    <div className="space-y-3">
      {/* Status legend */}
      <div className="flex flex-wrap items-center gap-3">
        {LEGEND_ITEMS.map((item) => {
          const config = statusConfig[item.status];
          const Icon = config.icon;
          const count = chapters.filter((c) => getCellStatus(c) === item.status).length;
          return (
            <div key={item.status} className="flex items-center gap-1.5">
              <div className={cn("flex items-center justify-center w-4 h-4 rounded border", config.color)}>
                <Icon className="h-2.5 w-2.5" />
              </div>
              <span className="text-[10px] text-muted-foreground">{item.label}</span>
              {count > 0 && <span className="text-[10px] text-muted-foreground/50">({count})</span>}
            </div>
          );
        })}
      </div>

      {/* Chapter grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
        {chapters.map((c) => {
          const status = getCellStatus(c);
          const config = statusConfig[status];
          const Icon = config.icon;
          const spinning = status === "scraping" || status === "transcribing" || status === "rendering";

          return (
            <a
              key={c.index}
              href={c.status === "scraped" || c.status === "transcribed" || c.status === "rendered" || c.transcribed
                ? `/api/preview/${jobId}/${c.index}/001.jpg`
                : undefined}
              target={c.status !== "pending" && c.status !== "error" ? "_blank" : undefined}
              rel="noopener noreferrer"
              title={`Ch. ${c.chapterNum ?? c.index}${c.title ? ` — ${c.title}` : ""}\n${config.label} · ${c.pageCount} pages`}
              className={cn(
                "aspect-square rounded-md border flex flex-col items-center justify-center gap-1 transition-all duration-200 text-xs font-medium relative group",
                config.color,
                spinning && "glow-pulse",
                c.status !== "pending" && c.status !== "error" && "hover:scale-110 hover:z-10 cursor-pointer"
              )}
            >
              <Icon className={cn("h-4 w-4", spinning && "animate-spin")} />
              <span className="font-mono text-[10px] leading-none">
                {c.chapterNum ?? c.index}
              </span>
              {/* Hover tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-lg bg-popover border border-border text-[10px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                {config.label} · {c.pageCount}p
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
