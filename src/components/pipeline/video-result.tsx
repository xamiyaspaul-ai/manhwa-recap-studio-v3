"use client";

import { useState, useEffect } from "react";
import { Download, Film, CheckCircle2, Share2, Image as ImageIcon, BookOpen, Clock, Cloud, CloudUpload, Loader2, HardDrive, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { JobDetail } from "@/types/pipeline";
import { useToast } from "@/hooks/use-toast";

interface VideoResultProps {
  job: JobDetail;
}

export function VideoResult({ job }: VideoResultProps) {
  const { toast } = useToast();
  const [archiving, setArchiving] = useState(false);
  const [archiveProvider, setArchiveProvider] = useState<string | null>(
    job.archiveProvider ?? null
  );
  const [ytMetadata, setYtMetadata] = useState<{
    title: string;
    description: string;
    tags: string[];
    hashtags: string[];
  } | null>(null);
  const [ytLoading, setYtLoading] = useState(false);

  // Fetch YouTube metadata when the video result loads
  useEffect(() => {
    fetch(`/api/jobs/${job.id}/youtube-metadata`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.metadata) {
          setYtMetadata(data.metadata);
        }
      })
      .catch(() => {});
  }, [job.id]);

  const handleCopyMetadata = async () => {
    if (!ytMetadata) {
      setYtLoading(true);
      try {
        const res = await fetch(`/api/jobs/${job.id}/youtube-metadata`);
        const data = await res.json();
        if (data?.metadata) {
          setYtMetadata(data.metadata);
        } else {
          throw new Error(data?.error || "Not generated yet");
        }
      } catch (e) {
        toast({
          title: "Metadata not available",
          description: e instanceof Error ? e.message : "YouTube metadata hasn't been generated yet",
          variant: "destructive",
        });
        setYtLoading(false);
        return;
      }
      setYtLoading(false);
    }

    const text = `TITLE:\n${ytMetadata?.title || ""}\n\nDESCRIPTION:\n${ytMetadata?.description || ""}\n\nTAGS:\n${(ytMetadata?.tags || []).join(", ")}\n\nHASHTAGS:\n${(ytMetadata?.hashtags || []).join(" ")}`;

    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied!", description: "YouTube metadata copied to clipboard" });
    } catch {
      // Fallback: create a textarea and select it
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        toast({ title: "Copied!", description: "YouTube metadata copied to clipboard" });
      } catch {
        toast({ title: "Copy failed", description: "Please copy manually from the metadata file", variant: "destructive" });
      }
      document.body.removeChild(textarea);
    }
  };

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

  const handleArchive = async () => {
    setArchiving(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/archive`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Archive failed (${res.status})`);
      }
      setArchiveProvider(data.provider);
      toast({
        title: "Archived to Mega",
        description: "Video uploaded to Mega and local file freed.",
      });
    } catch (e) {
      toast({
        title: "Archive failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setArchiving(false);
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
        <div className="flex items-center gap-2">
          {archiveProvider && (
            <Badge variant="outline" className="border-sky-500/30 text-sky-400 gap-1">
              <Cloud className="h-3 w-3" />
              Mega
            </Badge>
          )}
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
            100% Complete
          </Badge>
        </div>
      </div>

      {/* Video player */}
      <div className="rounded-lg overflow-hidden bg-black border border-border">
        <video
          controls
          className="w-full max-h-[480px]"
          preload="metadata"
          onError={(e) => {
            console.error("Video playback error:", e);
          }}
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
        {archiveProvider ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30">
            <Cloud className="h-3.5 w-3.5 text-sky-400" />
            <span className="text-xs font-medium text-sky-400">
              Archived to Mega
            </span>
          </div>
        ) : job.autoArchive ? (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <CloudUpload className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
            <span className="text-xs font-medium text-amber-400">Auto-archiving…</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card/50 border border-border">
            <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Local storage</span>
          </div>
        )}
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
        {!archiveProvider && (
          <Button
            variant="outline"
            size="lg"
            onClick={handleArchive}
            disabled={archiving}
          >
            {archiving ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <CloudUpload className="h-5 w-5 mr-2" />
            )}
            {archiving ? "Archiving…" : "Archive to cloud"}
          </Button>
        )}
      </div>

      {/* YouTube-ready section — SEO optimized */}
      <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Youtube className="h-4 w-4 text-red-500" />
            <span className="text-sm font-medium">YouTube-Ready (SEO Optimized)</span>
          </div>
          <button
            onClick={handleCopyMetadata}
            disabled={ytLoading}
            className="text-xs px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition border border-red-500/20 disabled:opacity-50"
          >
            {ytLoading ? "Loading..." : ytMetadata ? "Copy Metadata ✓" : "Copy Metadata"}
          </button>
        </div>

        {/* Feature badges */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2 py-1 rounded bg-card/50 border border-border">🎬 H.264 1080p + faststart</span>
          <span className="px-2 py-1 rounded bg-card/50 border border-border">🖼️ High-CTR thumbnail</span>
          <span className="px-2 py-1 rounded bg-card/50 border border-border">📝 SEO title + description</span>
          <span className="px-2 py-1 rounded bg-card/50 border border-border">🏷️ 15+ optimized tags</span>
          <span className="px-2 py-1 rounded bg-card/50 border border-border">⏱️ Auto timestamps</span>
        </div>

        {/* Metadata preview (when loaded) */}
        {ytMetadata && (
          <div className="p-3 rounded-lg bg-card/50 border border-border space-y-1 text-xs">
            <p className="font-medium text-foreground">Title:</p>
            <p className="text-muted-foreground">{ytMetadata.title}</p>
            <p className="font-medium text-foreground mt-2">Tags ({ytMetadata.tags?.length || 0}):</p>
            <p className="text-muted-foreground text-[11px]">{(ytMetadata.tags || []).join(", ")}</p>
          </div>
        )}

        {/* SEO tips */}
        <div className="text-[11px] text-muted-foreground space-y-1">
          <p className="font-medium text-foreground/70">📈 Algorithm tips for max views:</p>
          <ul className="ml-4 space-y-0.5 text-muted-foreground">
            <li>• Upload <code>youtube_ready.mp4</code> (optimized encoding survives YT compression)</li>
            <li>• Set <code>thumbnail.jpg</code> as custom thumbnail (high-contrast, bold text)</li>
            <li>• Copy title + description from <code>youtube_metadata.json</code> (keywords front-loaded)</li>
            <li>• Add all tags — they help discovery in YouTube search</li>
            <li>• Publish as <strong>private</strong> first, check everything, then make public</li>
            <li>• First 15 seconds matter most for watch time — the thumbnail + title set expectations</li>
          </ul>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Files in <code className="text-muted-foreground">output/youtube/</code> directory.
          All generated with free tools (ffmpeg + PIL).
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Video includes narrated chapter transcriptions with text-to-speech audio. Source: {job.mangaTitle} · {job.totalChapters} chapters · {job.totalImages} images.
        {archiveProvider && " Local file freed after cloud upload — video streams from cloud on demand."}
      </p>
    </div>
  );
}
