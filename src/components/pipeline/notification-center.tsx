"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Bell, CheckCircle2, AlertCircle, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { JobDetail, JobStatus } from "@/types/pipeline";

interface NotificationItem {
  id: string;
  icon: typeof CheckCircle2;
  title: string;
  description: string;
  time: string;
  color: string;
  iconColor: string;
}

function getStatusMeta(status: JobStatus): {
  icon: typeof CheckCircle2;
  color: string;
  iconColor: string;
} {
  switch (status) {
    case "done":
      return { icon: CheckCircle2, color: "", iconColor: "text-emerald-400" };
    case "error":
      return { icon: AlertCircle, color: "", iconColor: "text-rose-400" };
    case "cancelled":
      return { icon: AlertCircle, color: "", iconColor: "text-muted-foreground" };
    case "pending":
      return { icon: Clock, color: "", iconColor: "text-muted-foreground" };
    default:
      return { icon: Loader2, color: "", iconColor: "text-amber-400" };
  }
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function jobToNotification(job: JobDetail): NotificationItem {
  const { icon, iconColor } = getStatusMeta(job.status);
  let description = "";
  switch (job.status) {
    case "done":
      description = `Completed — ${job.totalChapters} chapters, ${job.totalImages} images`;
      break;
    case "error":
      description = `Failed: ${job.error || "Unknown error"}`;
      break;
    case "cancelled":
      description = "Cancelled";
      break;
    case "pending":
      description = "Waiting to start...";
      break;
    default:
      description = `In progress — ${job.progress}%`;
      break;
  }

  return {
    id: job.id,
    icon,
    title: job.mangaTitle,
    description,
    time: relativeTime(job.createdAt),
    color: "",
    iconColor,
  };
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Derive loading from open + notifications being empty (no extra state needed)
  const loading = open && notifications.length === 0;

  // Fetch jobs when dropdown opens (render-time trigger)
  const [prevOpen, setPrevOpen] = useState(false);
  if (open && !prevOpen) {
    setPrevOpen(true);
    setNotifications([]);
    fetch("/api/jobs")
      .then((res) => res.json())
      .then((data) => {
        const jobs: JobDetail[] = (data.jobs ?? []).slice(0, 10);
        const items = jobs.map(jobToNotification);
        setNotifications(items);
        setHasUnread(
          jobs.some(
            (j) =>
              j.status === "error" ||
              j.status === "pending" ||
              (j.status !== "done" && j.status !== "cancelled")
          )
        );
      })
      .catch(() => {
        setNotifications([]);
      });
  }
  if (!open && prevOpen) {
    setPrevOpen(false);
  }

  const handleMarkAllRead = useCallback(() => {
    setHasUnread(false);
  }, []);

  // Click-outside to close (setState in callback is fine)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {hasUnread && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-rose-500 rounded-full border-2 border-background" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-h-80 overflow-y-auto scrollbar-thin rounded-xl border border-border bg-popover shadow-xl animate-fade-in-scale z-50">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border sticky top-0 bg-popover z-10">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Notifications</span>
              {notifications.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {notifications.length}
                </Badge>
              )}
            </div>
            {hasUnread && (
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Content */}
          <div className="p-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <Bell className="h-8 w-8 opacity-30" />
                <p className="text-sm">No recent activity</p>
              </div>
            ) : (
              notifications.map((n) => {
                const Icon = n.icon;
                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Icon
                      className={`h-4 w-4 mt-0.5 shrink-0 ${n.iconColor}${
                        n.icon === Loader2 ? " animate-spin" : ""
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {n.description}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap mt-0.5">
                      {n.time}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
