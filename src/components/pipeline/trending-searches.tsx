"use client";

import { useState } from "react";
import { TrendingUp, Flame, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSectionObserver } from "@/hooks/use-section-observer";

const TRENDING = [
  { title: "Solo Leveling", icon: "⚔️" },
  { title: "Tower of God", icon: "🗼" },
  { title: "The Beginning After The End", icon: "✨" },
  { title: "Omniscient Reader", icon: "📖" },
  { title: "Nano Machine", icon: "🤖" },
  { title: "The Greatest Estate Developer", icon: "🏗️" },
];

interface TrendingSearchesProps {
  onPick: (query: string) => void;
}

export function TrendingSearches({ onPick }: TrendingSearchesProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const { ref, isVisible } = useSectionObserver(0.1);

  return (
    <section ref={ref} className="max-w-4xl mx-auto">
      <div className={`transition-all duration-700 ${isVisible ? "animate-section-in" : "opacity-0"}`}>
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
              Trending Now
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {TRENDING.map((item, i) => {
            const Icon = i % 2 === 0 ? Flame : Sparkles;
            return (
              <button
                key={item.title}
                onClick={() => onPick(item.title)}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  "group flex items-center gap-2 text-xs px-4 py-2 rounded-xl border transition-all duration-200 relative",
                  isVisible ? "animate-item-in" : "opacity-0",
                  hovered === i
                    ? "border-primary/40 text-primary scale-105 shadow-md shadow-primary/10 bg-primary/5"
                    : "bg-card/50 border-border text-muted-foreground hover:text-foreground hover:bg-card/80 hover:border-primary/20"
                )}
                style={{ animationDelay: isVisible ? `${i * 60}ms` : "0ms" }}
              >
                {/* Rank number */}
                <span className={cn(
                  "text-[9px] font-mono font-bold w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200",
                  hovered === i
                    ? "bg-primary text-primary-foreground scale-110"
                    : i < 3
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground/60"
                )}>
                  {i + 1}
                </span>
                <span className="text-sm">{item.icon}</span>
                <span className="font-medium">{item.title}</span>
                {/* Gradient border glow on hover */}
                {hovered === i && (
                  <span className="absolute inset-0 rounded-xl border border-primary/20 animate-glow-border pointer-events-none" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
