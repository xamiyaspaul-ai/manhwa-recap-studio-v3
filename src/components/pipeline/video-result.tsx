"use client";

import { Download, Film, CheckCircle2, Share2, Image as ImageIcon, BookOpen, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { JobSummary } from "@/types/pipeline";
import { useToast } from "@/hooks/use-toast";

interface VideoResultProps {
  job: JobSummary;
}

export function VideoResult({ job }: VideoResultProps) {
  const { toast } = useToast();

  const handleShare = async () => {
    const url = `${window.location.origin}/api/download/${job.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${job.mangaTitle} Recap`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied", description: "Video URL copied to clipboard" });
      }
    } catch {
      // user cancelled share
    }
  };

  const safeTitle = job.mangaTitle.replace(/[^a-z0-9]+/gi, "_");

  return (
    <div className="p-6 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-4 animate-fade-in-up">
      {/* Header with success badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/15">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-emerald-300">Recap video ready!</h3>
            <p className="text-xs text-emerald-400/60">Pipeline completed successfully</p>
          </div>
        </div>
        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
          100% Complete
        </Badge>
      </div>

      {/* Video player */}
      <div className="rounded-lg overflow-hidden bg-black border border-border">
        <video
          controls
          className="w-full max-h-[480px]"
          preload="metadata"
        >
          <source src={`/api/download/${job.id}`} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
      </div>

      {/* Video stats */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/50 border border-border">
          <BookOpen className="h-3.5 w-3.5 text-sky-400" />
          <span className="text-xs font-medium">{job.totalChapters} chapter{job.totalChapters !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/50 border border-border">
          <ImageIcon className="h-3.5 w-3.5 text-fuchsia-400" />
          <span className="text-xs font-medium">{job.totalImages} images</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/50 border border-border">
          <Clock className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-medium">
            {job.voice.replace(/^[a-z]{2}-[A-Z]{2}-/, "").replace(/Neural$/, "").replace(/Multilingual$/, " ML")}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg" className="font-semibold">
          <a href={`/api/download/${job.id}`} download={`${safeTitle}_recap.mp4`}>
            <Download className="h-5 w-5 mr-2" />
            Download MP4
          </a>
        </Button>
        <Button asChild variant="outline" size="lg">
          <a href={`/api/download/${job.id}`} target="_blank" rel="noopener noreferrer">
            <Film className="h-5 w-5 mr-2" />
            Open in new tab
          </a>
        </Button>
        <Button variant="outline" size="lg" onClick={handleShare}>
          <Share2 className="h-5 w-5 mr-2" />
          Share
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Video includes narrated chapter summaries with text-to-speech audio. Source: {job.mangaTitle} · {job.totalChapters} chapters · {job.totalImages} images.
      </p>
    </div>
  );
}
