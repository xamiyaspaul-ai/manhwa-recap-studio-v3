"use client";

import { Star, Quote } from "lucide-react";
import { useSectionObserver } from "@/hooks/use-section-observer";

const TESTIMONIALS = [
  {
    name: "Alex K.",
    handle: "@alex_recaps",
    avatar: "AK",
    avatarColor: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    rating: 5,
    text: "I went from spending 4 hours manually editing recap videos to under 10 minutes. The VLM transcription is shockingly accurate.",
    stat: "200+ videos",
    statLabel: "created",
  },
  {
    name: "Sarah M.",
    handle: "@manga_sarah",
    avatar: "SM",
    avatarColor: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    rating: 5,
    text: "The multi-source search saved me so much time. Found chapters on AsuraScans that weren't on MangaDex. Absolute game changer.",
    stat: "50+ series",
    statLabel: "processed",
  },
  {
    name: "Jordan L.",
    handle: "@jordan_wt",
    avatar: "JL",
    avatarColor: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
    rating: 5,
    text: "Completely free and runs locally? I was skeptical, but the quality rivals paid tools. The TTS voices sound surprisingly natural.",
    stat: "$0 cost",
    statLabel: "total spent",
  },
  {
    name: "Priya R.",
    handle: "@priya_manhwa",
    avatar: "PR",
    avatarColor: "bg-sky-500/15 text-sky-400 border-sky-500/30",
    rating: 5,
    text: "The auto-archive to Mega is genius. I can process entire series without worrying about disk space. Cloud restore just works.",
    stat: "500GB+",
    statLabel: "archived",
  },
  {
    name: "Mike T.",
    handle: "@mike_toons",
    avatar: "MT",
    avatarColor: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    rating: 4,
    text: "Panel detection with YOLO is great — no more chopped panels in my videos. The sequential chapter processing is rock solid.",
    stat: "1000+ ch",
    statLabel: "rendered",
  },
  {
    name: "Yuki H.",
    handle: "@yuki_reads",
    avatar: "YH",
    avatarColor: "bg-teal-500/15 text-teal-400 border-teal-500/30",
    rating: 5,
    text: "I use this for Japanese manga too — the multi-language support with 9 languages is incredible. Korean manhwa translation is spot on.",
    stat: "9 languages",
    statLabel: "supported",
  },
];

export function Testimonials() {
  const { ref, isVisible } = useSectionObserver(0.05);

  return (
    <section className="max-w-6xl mx-auto py-4">
      <div
        ref={ref}
        className={`transition-all duration-700 ${isVisible ? "animate-section-in" : "opacity-0"}`}
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 mb-3">
            <Star className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
              Community
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Loved by creators</h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-lg mx-auto leading-relaxed">
            Join thousands of manga enthusiasts who use Manhwa Recap Studio to create content faster
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TESTIMONIALS.map((t, i) => (
            <div
              key={t.handle}
              className={`group relative p-5 rounded-xl border border-border bg-card/50 hover:border-primary/20 hover:bg-card/80 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 ${isVisible ? "animate-item-in" : "opacity-0"}`}
              style={{ animationDelay: isVisible ? `${i * 80}ms` : "0ms" }}
            >
              {/* Quote icon */}
              <Quote className="h-6 w-6 text-primary/10 group-hover:text-primary/20 transition-colors mb-3" />

              {/* Stars */}
              <div className="flex items-center gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, si) => (
                  <Star
                    key={si}
                    className={`h-3 w-3 ${si < t.rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"}`}
                  />
                ))}
              </div>

              {/* Review text */}
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                &ldquo;{t.text}&rdquo;
              </p>

              {/* User info + stat */}
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-bold ${t.avatarColor}`}
                  >
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{t.name}</p>
                    <p className="text-[10px] text-muted-foreground">{t.handle}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-primary tabular-nums">{t.stat}</p>
                  <p className="text-[9px] text-muted-foreground/60">{t.statLabel}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
