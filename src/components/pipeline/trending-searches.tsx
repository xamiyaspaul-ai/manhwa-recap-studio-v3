"use client";

import { useState } from "react";
import { TrendingUp, Flame, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

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

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto">
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
              hovered === i
                ? "border-primary/40 text-primary scale-105"
                : "bg-card/50 border-border text-muted-foreground hover:text-foreground"
            )}
            style={{
              background: hovered === i
                ? "linear-gradient(135deg, oklch(0.78 0.17 65 / 0.08), oklch(0.78 0.17 65 / 0.15))"
                : "bg-card/50",
            }}
          >
            <Icon
              className={cn(
                "h-3 w-3 transition-colors",
                hovered === i ? "text-primary" : "text-muted-foreground/50"
              )}
            />
            <span>{title}</span>
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
