"use client";

import { useEffect, useState, useRef } from "react";
import { Film, BookOpen, ImageIcon, CheckCircle2, Cloud, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  totalJobs: number;
  completedJobs: number;
  totalChapters: number;
  totalImages: number;
  archivedJobs?: number;
}

/** Animated counter that counts from 0 to target value on mount */
function AnimatedCounter({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const prevTargetRef = useRef<number>(0);

  useEffect(() => {
    // Reset when target changes
    if (target !== prevTargetRef.current) {
      prevTargetRef.current = target;
      startTimeRef.current = null;
      // Kick off animation from 0
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      const tick = (timestamp: number) => {
        if (startTimeRef.current === null) startTimeRef.current = timestamp;
        const elapsed = timestamp - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(eased * target);
        setDisplay(value);
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setDisplay(target);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return <span>{display.toLocaleString()}</span>;
}

export function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !data.error) setStats(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Shimmer loading skeleton while fetching
  if (loading) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 py-4">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-card/50"
          >
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-4 w-8 rounded" />
            <Skeleton className="h-3 w-16 rounded hidden sm:block" />
          </div>
        ))}
      </div>
    );
  }

  // Welcome message when no jobs exist
  if (!stats || stats.totalJobs === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 space-y-2 animate-fade-in-up">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card/30">
          <Sparkles className="h-4 w-4 text-primary/60" />
          <p className="text-sm text-muted-foreground">
            No videos created yet —{" "}
            <span className="text-foreground/80 font-medium">search for a manhwa above</span>{" "}
            to get started!
          </p>
        </div>
      </div>
    );
  }

  const items = [
    { icon: Film, label: "Videos Created", value: stats.completedJobs, color: "text-emerald-400" },
    { icon: BookOpen, label: "Jobs Total", value: stats.totalJobs, color: "text-sky-400" },
    { icon: CheckCircle2, label: "Chapters Processed", value: stats.totalChapters, color: "text-amber-400" },
    { icon: ImageIcon, label: "Images Scraped", value: stats.totalImages, color: "text-fuchsia-400" },
  ];

  if (stats.archivedJobs && stats.archivedJobs > 0) {
    items.push({ icon: Cloud, label: "Cloud Archived", value: stats.archivedJobs, color: "text-sky-400" });
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 py-4 animate-fade-in-up">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/50 border border-border">
            <Icon className={`h-4 w-4 ${item.color}`} />
            <span className="text-sm font-semibold tabular-nums">
              <AnimatedCounter target={item.value} />
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
