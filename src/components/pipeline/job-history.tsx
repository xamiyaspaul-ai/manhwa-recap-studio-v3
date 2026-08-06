"use client";

import { useEffect, useState } from "react";
import { History, ChevronRight, Loader2, CheckCircle2, AlertCircle, Clock, XCircle, Trash2, Film, Cloud } from "lucide-react";
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

  if (!loading && jobs.length === 0) {
    return (
      <section ref={ref} className={`max-w-5xl mx-auto transition-all duration-700 ${isVisible ? "animate-section-in" : "opacity-0"}`}>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition w-full group"
        >
          <div className="p-1.5 rounded-lg bg-muted/50 group-hover:bg-muted transition">
            <History className="h-4 w-4" />
          </div>
          Recent jobs
          <ChevronRight className={`h-4 w-4 ml-auto transition-transform ${open ? "rotate-90" : ""}`}
          />
        </button>
        <div className="flex flex-col items-center justify-center py-12 space-y-3 animate-fade-in-up">
          <div className="p-4 rounded-full bg-muted/50 border border-border">
            <Film className="h-8 w-8 text-muted-foreground/40" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-muted-foreground">No jobs yet</p>
            <p className="text-xs text-muted-foreground/60">
              Search for a manhwa above to create your first recap video
            </p>
          </div>
        </div>
      </section>
    );
  }

  const completedCount = jobs.filter((j) => j.status === "done").length;

  return (
    <section ref={ref} className={`max-w-5xl mx-auto transition-all duration-700 ${isVisible ? "animate-section-in" : "opacity-0"}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition w-full group"
      >
        <div className="p-1.5 rounded-lg bg-muted/50 group-hover:bg-muted transition">
          <History className="h-4 w-4" />
        </div>
        Recent jobs
        <span className="text-xs text-muted-foreground/60">
          ({jobs.length}{completedCount > 0 ? ` · ${completedCount} completed` : ""})
        </span>
        <ChevronRight className={`h-4 w-4 ml-auto transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="mt-3 space-y-2">
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
                className={`w-full flex items-center gap-3 p-3 rounded-xl border bg-card hover:border-primary/40 hover:bg-accent/30 transition-all duration-200 text-left group cursor-pointer ${statusBgColor[job.status]}`}
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
