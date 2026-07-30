"use client";

import { useEffect, useState } from "react";
import { Film, BookOpen, ImageIcon, CheckCircle2 } from "lucide-react";

interface Stats {
  totalJobs: number;
  completedJobs: number;
  totalChapters: number;
  totalImages: number;
}

export function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && !data.error) setStats(data);
      })
      .catch(() => {});
  }, []);

  if (!stats || stats.totalJobs === 0) return null;

  const items = [
    { icon: Film, label: "Videos Created", value: stats.completedJobs, color: "text-emerald-400" },
    { icon: BookOpen, label: "Jobs Total", value: stats.totalJobs, color: "text-sky-400" },
    { icon: CheckCircle2, label: "Chapters Processed", value: stats.totalChapters, color: "text-amber-400" },
    { icon: ImageIcon, label: "Images Scraped", value: stats.totalImages, color: "text-fuchsia-400" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 py-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/50 border border-border">
            <Icon className={`h-4 w-4 ${item.color}`} />
            <span className="text-sm font-semibold tabular-nums">{item.value}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
