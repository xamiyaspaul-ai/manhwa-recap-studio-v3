"use client";

import { Search, ScanLine, Eye, Scissors, Clapperboard, ArrowRight } from "lucide-react";

const STEPS = [
  { icon: Search, title: "Search", desc: "Enter any manhwa title. We query 6 sources at once — MangaHere, FanFox, Webtoons, AsuraScans, MAL & AniList." },
  { icon: ScanLine, title: "Download", desc: "Scrapes all panel images from every chapter automatically using source-specific scrapers." },
  { icon: Eye, title: "Transcribe", desc: "Vision AI reads speech bubbles and captions from each panel, transcribing the exact dialogue." },
  { icon: Scissors, title: "Detect Panels", desc: "YOLO + contour-based detection finds panel boundaries. No chopping — each panel stays complete." },
  { icon: Clapperboard, title: "Render Video", desc: "Panels are voiced with edge-tts narration and merged into a single recap MP4 with ffmpeg." },
];

export function HowItWorks() {
  return (
    <section className="max-w-6xl mx-auto py-8">
      <div className="text-center mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          How it works
        </h2>
        <p className="text-xs text-muted-foreground/60 mt-1">5-step automated pipeline</p>
      </div>
      <div className="flex flex-col lg:flex-row items-stretch gap-3 lg:gap-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isLast = i === STEPS.length - 1;
          return (
            <div key={s.title} className="flex items-stretch lg:flex-1">
              <div
                className="group p-4 rounded-xl border border-border bg-card/50 space-y-3 relative overflow-hidden hover:border-primary/30 hover:bg-card/80 transition-all duration-300 flex-1 lg:mx-1"
              >
                {/* Step number badge */}
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-3xl font-bold text-muted-foreground/10 group-hover:text-primary/20 transition select-none">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </div>
              {!isLast && (
                <div className="hidden lg:flex items-center px-0.5">
                  <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
