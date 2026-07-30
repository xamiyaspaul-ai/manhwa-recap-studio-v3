"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "How does the manhwa recap pipeline work?",
    answer:
      "The pipeline has 5 stages: (1) Search across 6 sources (MangaHere, FanFox, Webtoons, AsuraScans, MAL, AniList). " +
      "(2) Download every chapter image. (3) Transcribe speech bubble text using VLM (vision language model). " +
      "(4) Generate narration with edge-tts text-to-speech. (5) Render the final MP4 video with ffmpeg — " +
      "panels synced to narration audio. The whole process takes ~6 minutes per chapter.",
  },
  {
    question: "Why is there no voice in my video?",
    answer:
      "This happens when all VLM providers are rate-limited (429 errors). The pipeline transcribes panel text " +
      "using z-ai, Groq, and Gemini — if all three are rate-limited simultaneously, panels get empty text and " +
      "no narration is generated. The system automatically retries with backoff. Wait 30-60 minutes for the " +
      "rate limit to reset, then run the job again. The VLM cache also reuses successful transcriptions from " +
      "previous runs, so re-running a failed job is faster.",
  },
  {
    question: "How do I speed up transcription?",
    answer:
      "VLM transcription is the slowest stage. To speed it up: (1) Set GROQ_API_KEY — Groq's LPU hardware is " +
      "3-5x faster than other providers. Get a free key at console.groq.com/keys. (2) Set GEMINI_API_KEY as a " +
      "second provider. (3) Adjust VLM_CONCURRENCY in .env (default 2, max 4) — higher = faster but more 429 errors. " +
      "(4) The VLM cache reuses transcriptions from previous runs of the same manga, so re-runs are instant.",
  },
  {
    question: "Can I use a different narration voice?",
    answer:
      "Yes! There are 55 voices available across 8 English accents (US, UK, AU, CA, IE, IN, ZA) plus 8 other " +
      "languages (Japanese, Korean, Spanish, French, German, Portuguese, Hindi, Chinese). Click the speaker icon " +
      "next to the voice dropdown to preview any voice before starting the pipeline.",
  },
  {
    question: "Where are my videos stored?",
    answer:
      "By default, videos are stored locally in the data/jobs/{jobId}/output/ directory. If you configure Mega " +
      "cloud archive (MEGA_EMAIL + MEGA_PASSWORD in .env), finished videos automatically upload to Mega (20 GB free) " +
      "and the local file is deleted to free disk space. When you watch a video, it's transparently restored from " +
      "Mega to a 1-hour temp cache and streamed with seek support.",
  },
  {
    question: "Why did my job fail or get stuck?",
    answer:
      "Common causes: (1) The pipeline-service crashed or restarted mid-job — the service auto-requeues stuck jobs " +
      "on restart, so just refresh the page. (2) Network issues during scraping — try again or pick a different manga. " +
      "(3) Disk space full — check available space. (4) All VLM providers rate-limited — wait 30-60 min and retry. " +
      "You can click the Retry button on any failed/stuck job to restart it without re-entering config.",
  },
  {
    question: "What does 'Archive to cloud' do?",
    answer:
      "The 'Archive to cloud' button manually uploads a completed video to Mega cloud storage and deletes the local " +
      "file. This frees disk space while keeping the video accessible — when you click Download or Play, the video is " +
      "automatically fetched from Mega. Auto-archive is enabled by default (set AUTO_ARCHIVE=false in .env to disable).",
  },
  {
    question: "Can I process multiple chapters at once?",
    answer:
      "Yes! In the Pipeline Configuration, set 'Chapters to process' to the number of chapters you want (or 0 for all). " +
      "Each chapter is processed sequentially — scraping, transcribing, and rendering one at a time. More chapters = " +
      "longer processing time (~6 min per chapter). The progress bar shows overall completion across all chapters.",
  },
  {
    question: "Is this free to use?",
    answer:
      "Yes, completely free. The pipeline uses: z-ai VLM (free tier), edge-tts (free, unlimited), ffmpeg (open source), " +
      "and YOLO panel detection (open source, runs locally). Optional free enhancements: Groq for faster VLM + narration " +
      "rewriting, Gemini as a second VLM provider, Mega for 20 GB cloud storage. No paid resources are required.",
  },
  {
    question: "How do I deploy this online?",
    answer:
      "See DEPLOYMENT.md for the full guide. The app can run as a single Docker container (Dockerfile included) on any " +
      "free Docker host. For Vercel deployment, set PIPELINE_SERVICE_URL to point to your laptop running the pipeline-service " +
      "(exposed via Cloudflare Tunnel). The Next.js frontend goes on Vercel (free), the database on Turso (free 9 GB), " +
      "and videos on Mega (free 20 GB) or local storage.",
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-primary" />
        <h2 className="text-xl font-bold">Frequently Asked Questions</h2>
      </div>
      <div className="space-y-2">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={i}
              className="rounded-lg border border-border bg-card overflow-hidden transition-all"
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                aria-expanded={isOpen}
              >
                <span className="text-sm font-medium">{item.question}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed">
                  {item.answer}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
