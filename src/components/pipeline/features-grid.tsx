"use client";

import { useSectionObserver } from "@/hooks/use-section-observer";
import {
  Search,
  ScanLine,
  Eye,
  Scissors,
  Clapperboard,
  Globe,
  Zap,
  Shield,
  type LucideIcon,
} from "lucide-react";

interface Feature {
  icon: LucideIcon;
  title: string;
  desc: string;
  stat: string;
  gradient: string;
}

const FEATURES: Feature[] = [
  {
    icon: Search,
    title: "Multi-Source Search",
    desc: "Query 6 manga databases simultaneously — MangaHere, FanFox, Webtoons, AsuraScans, MAL & AniList.",
    stat: "6 Sources",
    gradient: "from-amber-500/20 to-orange-500/10",
  },
  {
    icon: ScanLine,
    title: "Auto Scraping",
    desc: "Source-specific scrapers download every panel image from every chapter, deduplicated across mirrors.",
    stat: "Auto Chapter",
    gradient: "from-emerald-500/20 to-teal-500/10",
  },
  {
    icon: Eye,
    title: "VLM Transcription",
    desc: "Vision AI reads speech bubbles and captions from each panel with 3 provider fallback.",
    stat: "3 VLM Providers",
    gradient: "from-sky-500/20 to-blue-500/10",
  },
  {
    icon: Scissors,
    title: "Panel Detection",
    desc: "YOLO + contour analysis finds panel boundaries ensuring each panel stays complete and un-split.",
    stat: "YOLO AI",
    gradient: "from-fuchsia-500/20 to-purple-500/10",
  },
  {
    icon: Clapperboard,
    title: "Video Rendering",
    desc: "Panels voiced with 55+ TTS voices and merged into a single recap MP4 with ffmpeg.",
    stat: "55+ Voices",
    gradient: "from-rose-500/20 to-pink-500/10",
  },
  {
    icon: Globe,
    title: "Multi-Language",
    desc: "Translate from Korean, Japanese, Chinese, Spanish, French, German and more to English.",
    stat: "9+ Languages",
    gradient: "from-teal-500/20 to-cyan-500/10",
  },
  {
    icon: Zap,
    title: "Groq Accelerated",
    desc: "Optional Groq LPU hardware delivers 3-5x faster VLM transcription and narration rewriting.",
    stat: "3-5x Faster",
    gradient: "from-yellow-500/20 to-amber-500/10",
  },
  {
    icon: Shield,
    title: "100% Free & Local",
    desc: "Open-source stack with no paid requirements. All AI processing uses free-tier APIs.",
    stat: "$0 Cost",
    gradient: "from-lime-500/20 to-green-500/10",
  },
];

export function FeaturesGrid() {
  const { ref, isVisible } = useSectionObserver(0.1);

  return (
    <section className="max-w-6xl mx-auto py-8">
      <div
        ref={ref}
        className={`transition-all duration-700 ${isVisible ? "animate-section-in" : "opacity-0"}`}
      >
        <div className="text-center mb-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Platform Capabilities
          </h2>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Everything you need for manhwa recap videos
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className={
                  `group relative p-4 rounded-xl border border-border bg-card/50 hover:border-primary/30 hover:bg-card/80 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 cursor-default ${isVisible ? "animate-item-in" : "opacity-0"}`
                }
                style={{ animationDelay: isVisible ? `${i * 80}ms` : "0ms" }}
              >
                {/* Gradient accent at top */}
                <div className={`absolute inset-x-0 top-0 h-[2px] rounded-t-xl bg-gradient-to-r ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold mb-1 group-hover:text-primary transition-colors">
                      {f.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {f.desc}
                    </p>
                  </div>
                </div>

                {/* Stat badge */}
                <div className="mt-3 flex justify-end">
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-muted/80 text-muted-foreground border border-border">
                    {f.stat}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
