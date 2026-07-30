"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";

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
        <TrendingUp className="h-3.5 w-3.5 text-primary" />
        <span className="font-medium">Trending</span>
      </div>
      {TRENDING.map((title, i) => (
        <button
          key={title}
          onClick={() => onPick(title)}
          onMouseEnter={() => setHovered(i)}
          onMouseLeave={() => setHovered(null)}
          className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 ${
            hovered === i
              ? "bg-primary/20 border-primary/40 text-primary scale-105"
              : "bg-card/50 border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {title}
        </button>
      ))}
    </div>
  );
}
