"use client";

import { useState } from "react";
import { Search, ScanLine, Eye, Scissors, Clapperboard, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSectionObserver } from "@/hooks/use-section-observer";

const STEPS = [
  {
    icon: Search,
    title: "Search",
    desc: "Enter any manhwa title. We query 6 sources at once — MangaHere, FanFox, Webtoons, AsuraScans, MAL & AniList.",
    details: "Our parallel search engine hits all 6 manga databases simultaneously, returning results in under 5 seconds. Each source has specialized scrapers that understand the site structure.",
  },
  {
    icon: ScanLine,
    title: "Download",
    desc: "Scrapes all panel images from every chapter automatically using source-specific scrapers.",
    details: "Source-specific scrapers navigate chapter listings, download every panel image in order, and deduplicate across mirror sources. Supports MangaHere, FanFox, Webtoons, and AsuraScans formats.",
  },
  {
    icon: Eye,
    title: "Transcribe",
    desc: "Vision AI reads speech bubbles and captions from each panel, transcribing the exact dialogue.",
    details: "Multiple VLM providers (z-ai, Groq, Gemini) analyze each panel image to detect and transcribe speech bubble text. Results are cached to speed up re-runs.",
  },
  {
    icon: Scissors,
    title: "Detect Panels",
    desc: "YOLO + contour-based detection finds panel boundaries. No chopping — each panel stays complete.",
    details: "A YOLO model identifies individual panels within each manga page, then contour-based analysis refines boundaries to ensure panels are never split. Each panel becomes a video frame.",
  },
  {
    icon: Clapperboard,
    title: "Render Video",
    desc: "Panels are voiced with edge-tts narration and merged into a single recap MP4 with ffmpeg.",
    details: "edge-tts generates natural-sounding narration from panel text in 55+ voices across 8 English accents. ffmpeg syncs panel images to audio, adds transitions, optional BGM, and renders the final MP4.",
  },
];

export function HowItWorks() {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const { ref, isVisible } = useSectionObserver(0.1);

  return (
    <section ref={ref} className={`max-w-6xl mx-auto py-8 transition-all duration-700 ${isVisible ? "animate-section-in" : "opacity-0"}`}>
      <div className="text-center mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          How it works
        </h2>
        <p className="text-xs text-muted-foreground/60 mt-1">5-step automated pipeline</p>
      </div>

      {/* Desktop: horizontal layout */}
      <div className="hidden lg:flex items-stretch gap-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isLast = i === STEPS.length - 1;
          const isExpanded = expandedStep === i;
          const isHovered = hoveredStep === i;

          return (
            <div key={s.title} className="flex items-stretch flex-1">
              <div
                className={cn(
                  "group p-4 rounded-xl border space-y-3 relative overflow-hidden transition-all duration-300 flex-1 cursor-pointer",
                  isHovered || isExpanded
                    ? "animate-glow-border bg-card/80 shadow-lg shadow-primary/5"
                    : "border-border bg-card/50 hover:border-primary/30 hover:bg-card/80"
                )}
                onMouseEnter={() => setHoveredStep(i)}
                onMouseLeave={() => setHoveredStep(null)}
                onClick={() => setExpandedStep(isExpanded ? null : i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedStep(isExpanded ? null : i);
                  }
                }}
              >
                {/* Step number badge with gradient */}
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition",
                      isHovered && "animate-icon-bounce"
                    )}
                  >
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span
                    className="text-3xl font-bold select-none"
                    style={{
                      background: "linear-gradient(135deg, oklch(0.78 0.17 65 / 0.15), oklch(0.78 0.17 65 / 0.02))",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="animate-fade-in-up pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground/80 leading-relaxed">
                      {s.details}
                    </p>
                  </div>
                )}

                {/* Expand indicator */}
                <ChevronDown
                  className={cn(
                    "h-3 w-3 text-muted-foreground/40 transition-transform duration-200 absolute bottom-3 right-3",
                    isExpanded && "rotate-180"
                  )}
                />
              </div>

              {/* Animated gradient connector line */}
              {!isLast && (
                <div className="flex items-center px-0.5 flex-shrink-0">
                  <div
                    className="h-[2px] w-8 flex-shrink-0"
                    style={{
                      background: "linear-gradient(90deg, oklch(0.78 0.17 65 / 0.3), oklch(0.78 0.17 65 / 0.08))",
                      backgroundSize: "200% 100%",
                      animation: "gradient-slide 2s linear infinite",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical layout */}
      <div className="flex flex-col lg:hidden gap-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isLast = i === STEPS.length - 1;
          const isExpanded = expandedStep === i;
          const isHovered = hoveredStep === i;

          return (
            <div key={s.title} className="flex flex-col">
              <div
                className={cn(
                  "group p-4 rounded-xl border space-y-3 relative overflow-hidden transition-all duration-300 cursor-pointer",
                  isHovered || isExpanded
                    ? "animate-glow-border bg-card/80 shadow-lg shadow-primary/5"
                    : "border-border bg-card/50 hover:border-primary/30 hover:bg-card/80"
                )}
                onMouseEnter={() => setHoveredStep(i)}
                onMouseLeave={() => setHoveredStep(null)}
                onClick={() => setExpandedStep(isExpanded ? null : i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setExpandedStep(isExpanded ? null : i);
                  }
                }}
              >
                {/* Step number badge with gradient */}
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition",
                      isHovered && "animate-icon-bounce"
                    )}
                  >
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span
                    className="text-3xl font-bold select-none"
                    style={{
                      background: "linear-gradient(135deg, oklch(0.78 0.17 65 / 0.15), oklch(0.78 0.17 65 / 0.02))",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="animate-fade-in-up pt-2 border-t border-border/50">
                    <p className="text-xs text-muted-foreground/80 leading-relaxed">
                      {s.details}
                    </p>
                  </div>
                )}

                {/* Expand indicator */}
                <ChevronDown
                  className={cn(
                    "h-3 w-3 text-muted-foreground/40 transition-transform duration-200 absolute bottom-3 right-3",
                    isExpanded && "rotate-180"
                  )}
                />
              </div>

              {/* Vertical connecting line */}
              {!isLast && (
                <div className="flex justify-center py-0">
                  <div
                    className="w-[2px] h-6 flex-shrink-0"
                    style={{
                      background: "linear-gradient(180deg, oklch(0.78 0.17 65 / 0.3), oklch(0.78 0.17 65 / 0.08))",
                      backgroundSize: "100% 200%",
                      animation: "gradient-slide 2s linear infinite",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
