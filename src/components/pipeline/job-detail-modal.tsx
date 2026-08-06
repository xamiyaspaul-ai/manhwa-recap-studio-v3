"use client";

import { useMemo } from "react";
import { AlertCircle, Cloud } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { JobSummary, JobStatus, ChapterInfo } from "@/types/pipeline";

interface JobDetailModalProps {
  job: JobSummary | null;
  open: boolean;
  onClose: () => void;
}

const statusConfig: Record<JobStatus, { label: string; color: string; dotColor: string }> = {
  pending: { label: "Pending", color: "bg-amber-500/15 text-amber-400 border-amber-500/25", dotColor: "bg-amber-400" },
  scraping: { label: "Scraping", color: "bg-amber-500/15 text-amber-400 border-amber-500/25", dotColor: "bg-amber-400" },
  summarizing: { label: "Summarizing", color: "bg-orange-500/15 text-orange-400 border-orange-500/25", dotColor: "bg-orange-400" },
  translating: { label: "Translating", color: "bg-purple-500/15 text-purple-400 border-purple-500/25", dotColor: "bg-purple-400" },
  rendering: { label: "Rendering", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", dotColor: "bg-emerald-400" },
  merging: { label: "Merging", color: "bg-teal-500/15 text-teal-400 border-teal-500/25", dotColor: "bg-teal-400" },
  done: { label: "Done", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", dotColor: "bg-emerald-400" },
  error: { label: "Error", color: "bg-rose-500/15 text-rose-400 border-rose-500/25", dotColor: "bg-rose-400" },
  cancelled: { label: "Cancelled", color: "bg-muted/50 text-muted-foreground border-border", dotColor: "bg-muted-foreground" },
};

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function calcDuration(created: string, updated: string): string {
  const ms = new Date(updated).getTime() - new Date(created).getTime();
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return sec > 0 ? `${min}m ${sec}s` : `${min}m`;
  const hr = Math.floor(min / 60);
  const rm = min % 60;
  return rm > 0 ? `${hr}h ${rm}m` : `${hr}h`;
}

function MiniBar({ done, total, accent }: { done: number; total: number; accent: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-foreground font-mono tabular-nums w-16 text-right shrink-0">
        {done}/{total}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: accent }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground font-mono w-8 text-right shrink-0">{pct}%</span>
    </div>
  );
}

function ChapterStatusDot({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    done: "bg-emerald-400",
    completed: "bg-emerald-400",
    rendering: "bg-emerald-400",
    rendered: "bg-emerald-400",
    summarizing: "bg-orange-400",
    summarized: "bg-orange-400",
    translating: "bg-purple-400",
    translated: "bg-purple-400",
    scraping: "bg-amber-400",
    scraped: "bg-amber-400",
    pending: "bg-muted-foreground",
    error: "bg-rose-400",
    failed: "bg-rose-400",
  };
  const color = colorMap[status] ?? "bg-muted-foreground/50";
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", color)} />;
}

function chapterProgress(ch: ChapterInfo): number {
  if (ch.status === "done" || ch.status === "completed") return 100;
  if (ch.status === "rendered" || ch.status === "rendering") return 75;
  if (ch.status === "translated" || ch.status === "translating") return 50;
  if (ch.status === "summarized" || ch.status === "summarizing") return 30;
  if (ch.status === "scraped" || ch.status === "scraping") return 15;
  return 0;
}

export function JobDetailModal({ job, open, onClose }: JobDetailModalProps) {
  const duration = useMemo(
    () => (job ? calcDuration(job.createdAt, job.updatedAt) : ""),
    [job],
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin bg-popover border-border rounded-xl p-0 gap-0 animate-fade-in-scale">
        <div className="sticky top-0 z-10 bg-popover/95 backdrop-blur-sm border-b border-border px-6 py-4">
          <DialogHeader className="flex flex-row items-center gap-3">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold truncate pr-8">
                {job?.mangaTitle ?? "Job Details"}
              </DialogTitle>
            </div>
            {job && (
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 gap-1.5 text-[11px] font-medium border",
                  statusConfig[job.status].color,
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", statusConfig[job.status].dotColor)} />
                {statusConfig[job.status].label}
              </Badge>
            )}
          </DialogHeader>
        </div>

        {job && (
          <div className="px-6 py-4 space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">Progress</p>
                <div className="space-y-1.5">
                  <Progress value={job.progress} className="h-2" />
                  <p className="text-xs font-mono text-foreground tabular-nums">{job.progress}%</p>
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">Chapters</p>
                <MiniBar
                  done={job.doneChapters}
                  total={job.totalChapters}
                  accent="linear-gradient(90deg, oklch(0.78 0.17 65), oklch(0.72 0.18 45))"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">Images</p>
                <MiniBar
                  done={job.doneImages}
                  total={job.totalImages}
                  accent="linear-gradient(90deg, oklch(0.7 0.15 160), oklch(0.7 0.12 180))"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">Voice Name</p>
                <p className="text-sm text-foreground truncate">{job.voice || "—"}</p>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">Source Language</p>
                <p className="text-sm text-foreground">{job.sourceLang?.toUpperCase() ?? job.language?.toUpperCase() ?? "—"}</p>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">Translate</p>
                <p className={cn("text-sm font-medium", job.translate ? "text-emerald-400" : "text-muted-foreground")}>
                  {job.translate ? "Yes" : "No"}
                </p>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">Current Stage</p>
                <p className="text-sm text-foreground capitalize">{job.stage ?? "—"}</p>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">Created</p>
                <p className="text-sm text-foreground">{formatDateTime(job.createdAt)}</p>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">Updated</p>
                <p className="text-sm text-foreground">{formatDateTime(job.updatedAt)}</p>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">Processing Duration</p>
                <p className="text-sm text-foreground font-mono tabular-nums">{duration}</p>
              </div>

              {job.archiveProvider && (
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-1.5">Archive Provider</p>
                  <div className="flex items-center gap-1.5">
                    <Cloud className="h-3.5 w-3.5 text-sky-400" />
                    <p className="text-sm text-foreground capitalize">{job.archiveProvider}</p>
                  </div>
                </div>
              )}
            </div>

            {job.status === "error" && job.error && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-rose-400 mb-0.5">Error</p>
                    <p className="text-sm text-rose-300/90 leading-relaxed break-words">{job.error}</p>
                  </div>
                </div>
              </div>
            )}

            {job.chapters && job.chapters.length > 0 && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground mb-2">
                  Chapter Breakdown ({job.chapters.length})
                </p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="max-h-48 overflow-y-auto scrollbar-thin">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                        <tr className="border-b border-border">
                          <th className="text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-3 py-2 w-10">#</th>
                          <th className="text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-3 py-2">Title</th>
                          <th className="text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-3 py-2 w-20">Status</th>
                          <th className="text-left text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-3 py-2 w-28">Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {job.chapters.map((ch) => {
                          const pct = chapterProgress(ch);
                          return (
                            <tr
                              key={ch.mangadexId}
                              className="border-b border-border/50 last:border-b-0 hover:bg-muted/30 transition-colors"
                            >
                              <td className="px-3 py-2 text-xs text-muted-foreground font-mono tabular-nums">
                                {ch.index + 1}
                              </td>
                              <td className="px-3 py-2 text-xs text-foreground truncate max-w-[200px]" title={ch.title ?? undefined}>
                                {ch.title ? `Ch. ${ch.chapterNum ?? "?"} — ${ch.title}` : `Chapter ${ch.chapterNum ?? ch.index + 1}`}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5">
                                  <ChapterStatusDot status={ch.status} />
                                  <span className="text-xs text-muted-foreground capitalize">{ch.status}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all duration-500"
                                      style={{
                                        width: `${pct}%`,
                                        background: pct === 100 ? "oklch(0.7 0.15 160)" : "linear-gradient(90deg, oklch(0.78 0.17 65), oklch(0.72 0.18 45))",
                                      }}
                                    />
                                  </div>
                                  <span className="text-[10px] text-muted-foreground font-mono w-7 text-right tabular-nums">{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
