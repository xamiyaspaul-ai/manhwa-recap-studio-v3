"use client";

import { useEffect, useState } from "react";
import { History, ChevronRight, Loader2, CheckCircle2, AlertCircle, Clock, XCircle, Trash2, Film, Cloud, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSectionObserver } from "@/hooks/use-section-observer";
import type { JobSummary, JobStatus } from "@/types/pipeline";

interface JobHistoryProps {
  onSelectJob: (jobId: string) => void;
  refreshKey: number;
}

const statusIcon: Record<JobStatus, typeof Clock> = {
  pending: Clock,
  scraping: Loader2,
  summarizing: Loader2,
  translating: Loader2,
  rendering: Loader2,
  merging: Loader2,
  done: CheckCircle2,
  error: AlertCircle,
  cancelled: XCircle,
};

const statusColor: Record<JobStatus, string> = {
  pending: "text-amber-400",
  scraping: "text-amber-400",
  summarizing: "text-orange-400",
  translating: "text-purple-400",
  rendering: "text-emerald-400",
  merging: "text-teal-400",
  done: "text-emerald-400",
  error: "text-rose-400",
  cancelled: "text-muted-foreground",
};

const statusBgColor: Record<JobStatus, string> = {
  pending: "bg-amber-500/10 border-amber-500/20",
  scraping: "bg-amber-500/10 border-amber-500/20",
  summarizing: "bg-orange-500/10 border-orange-500/20",
  translating: "bg-purple-500/10 border-purple-500/20",
  rendering: "bg-emerald-500/10 border-emerald-500/20",
  merging: "bg-teal-500/10 border-teal-500/20",
  done: "bg-emerald-500/10 border-emerald-500/20",
  error: "bg-rose-500/10 border-rose-500/20",
  cancelled: "bg-muted/50 border-border",
};

const ACTIVE_STATUSES = new Set<JobStatus>([
  "pending",
  "scraping",
  "summarizing",
  "translating",
  "rendering",
  "merging",
]);

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function JobHistory({ onSelectJob, refreshKey }: JobHistoryProps) {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { ref, isVisible } = useSectionObserver(0.05);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setJobs(data.jobs ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleDelete = async (e: React.MouseEvent, job: JobSummary) => {
    e.stopPropagation();
    const isActive = ACTIVE_STATUSES.has(job.status);
    const confirmMsg = isActive
      ? `"${job.mangaTitle}" is still running. Stop and delete it?`
      : `Delete "${job.mangaTitle}" from recent jobs? This can't be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingId(job.id);
    try {
      const res = await fetch(`/api/jobs/${job.id}?force=true`, { method: "DELETE" });
      if (res.ok) {
        setJobs((prev) => prev.filter((j) => j.id !== job.id));
      }
    } catch {
      // best-effort
    } finally {
      setDeletingId(null);
    }
  };

  const completedCount = jobs.filter((j) => j.status === "done").length;

  return (
    <section ref={ref} className={`max-w-5xl mx-auto transition-all duration-700 ${isVisible ? "animate-section-in" : "opacity-0"}`}>
      {/* Section heading */}
      <div className="flex items-center gap-3 mb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5">
          <History className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            Job History
          </span>
        </div>
        {jobs.length > 0 && (
          <span className="text-xs text-muted-foreground/60">
            {jobs.length} job{jobs.length !== 1 ? "s" : ""}
            {completedCount > 0 && ` · ${completedCount} completed`}
          </span>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          className="ml-auto p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition"
          aria-label={open ? "Collapse history" : "Expand history"}
        >
          <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
        </button>
      </div>

      {/* Empty state */}
      {!loading && jobs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4 animate-fade-in-up">
          <div className="relative">
            <div className="p-5 rounded-2xl bg-muted/30 border border-border">
              <Film className="h-10 w-10 text-muted-foreground/30" />
            </div>
            <div className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-primary/10 border border-primary/20">
              <Play className="h-3.5 w-3.5 text-primary" />
            </div>
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-sm font-semibold text-muted-foreground">No jobs yet</p>
            <p className="text-xs text-muted-foreground/60 max-w-xs leading-relaxed">
              Search for a manhwa above to create your first recap video. It takes about 6 minutes per chapter.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40">
            <span className="px-2 py-0.5 rounded-md border border-border bg-muted/50">Scrape</span>
            <span>→</span>
            <span className="px-2 py-0.5 rounded-md border border-border bg-muted/50">Transcribe</span>
            <span>→</span>
            <span className="px-2 py-0.5 rounded-md border border-border bg-muted/50">Render</span>
            <span>→</span>
            <span className="px-2 py-0.5 rounded-md border border-border bg-muted/50">Video!</span>
          </div>
        </div>
      )}

      {open && jobs.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
          {jobs.map((job) => {
            const Icon = statusIcon[job.status] ?? Clock;
            const spinning = ["scraping", "summarizing", "translating", "rendering", "merging"].includes(job.status);
            const isDone = job.status === "done";
            return (
              <div
                key={job.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectJob(job.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelectJob(job.id);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border bg-card/60 hover:border-primary/40 hover:bg-accent/30 transition-all duration-200 text-left group cursor-pointer ${statusBgColor[job.status]}`}
              >
                {/* Cover image */}
                <div className="w-10 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border relative">
                  {job.coverUrl ? (
                    <img src={job.coverUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  )}
                  {isDone && (
                    <div className="absolute bottom-0 right-0 p-0.5 rounded-tl bg-emerald-500/80">
                      <CheckCircle2 className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>

                {/* Job info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{job.mangaTitle}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className={`h-3.5 w-3.5 ${statusColor[job.status]} ${spinning ? "animate-spin" : ""}`} />
                    <span className={`capitalize ${statusColor[job.status]}`}>{job.status}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span>{job.totalChapters} ch</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span>{job.progress}%</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span>{timeAgo(job.createdAt)}</span>
                    {isDone && job.archiveProvider && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="flex items-center gap-0.5 text-sky-400">
                          <Cloud className="h-3 w-3" />
                          <span className="text-[10px]">Mega</span>
                        </span>
                      </>
                    )}
                    {isDone && job.autoArchive && !job.archiveProvider && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="flex items-center gap-0.5 text-amber-400">
                          <Cloud className="h-3 w-3 animate-pulse" />
                          <span className="text-[10px]">Archiving…</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  aria-label={`Delete ${job.mangaTitle}`}
                  onClick={(e) => handleDelete(e, job)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition flex-shrink-0 opacity-0 group-hover:opacity-100"
                >
                  {deletingId === job.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </button>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition flex-shrink-0" />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
