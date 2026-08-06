"use client";

import { useState } from "react";
import { TrendingUp, Flame, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSectionObserver } from "@/hooks/use-section-observer";

const TRENDING = [
  "Solo Leveling",
  "Tower of God",
  "The Beginning After The End",
  "Omniscient Reader",
  "Nano Machine",
  "The Greatest Estate Developer",
];

interface TrendingSearchesProps {
  onPick: (query: string) => void;
}

export function TrendingSearches({ onPick }: TrendingSearchesProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const { ref, isVisible } = useSectionObserver(0.1);

  return (
    <div ref={ref} className={`flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto transition-all duration-700 ${isVisible ? "animate-section-in" : "opacity-0"}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
        <TrendingUp className="h-3.5 w-3.5 text-primary animate-pulse" />
        <span className="font-medium">Trending</span>
      </div>
      {TRENDING.map((title, i) => {
        const Icon = i % 2 === 0 ? Flame : Sparkles;
        return (
          <button
            key={title}
            onClick={() => onPick(title)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            className={cn(
              "group flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all duration-200 relative",
              isVisible ? "animate-item-in" : "opacity-0",
              hovered === i
                ? "border-primary/40 text-primary scale-105 shadow-sm shadow-primary/10"
                : "bg-card/50 border-border text-muted-foreground hover:text-foreground"
            )}
            style={{ animationDelay: isVisible ? `${i * 60}ms` : "0ms" }}
          >
            {/* Rank number */}
            <span className={cn(
              "text-[9px] font-mono font-bold w-3.5 h-3.5 rounded-md flex items-center justify-center transition-colors",
              hovered === i
                ? "bg-primary text-primary-foreground"
                : i < 3
                  ? "bg-primary/15 text-primary"
                  : "bg-muted text-muted-foreground/60"
            )}>
              {i + 1}
            </span>
            <Icon
              className={cn(
                "h-3 w-3 transition-colors",
                hovered === i ? "text-primary" : "text-muted-foreground/50"
              )}
            />
            <span className="font-medium">{title}</span>
            {/* Gradient border glow on hover */}
            {hovered === i && (
              <span className="absolute inset-0 rounded-full border border-primary/20 animate-glow-border pointer-events-none" />
            )}
          </button>
        );
      })}
    </div>
  );
}
