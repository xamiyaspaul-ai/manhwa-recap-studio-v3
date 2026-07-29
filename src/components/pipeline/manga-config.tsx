"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  Loader2,
  Play,
  Globe,
  BookOpen,
  Mic2,
  Key,
  Languages,
  Info,
  Clock,
  Volume2,
  Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { MangadexManga, AppSettings } from "@/types/pipeline";

interface MangaConfigProps {
  manga: MangadexManga;
  onBack: () => void;
  onJobCreated: (jobId: string) => void;
}

interface ChapterFeedItem {
  id: string;
  chapter: string | null;
  title: string | null;
  language: string;
  pages: number;
  volume: string | null;
}

const VOICES = [
  // ── English (US) ──
  { value: "en-US-AndrewMultilingualNeural", label: "Andrew Multilingual (US, male)" },
  { value: "en-US-AndrewNeural", label: "Andrew (US, male)" },
  { value: "en-US-BrianMultilingualNeural", label: "Brian Multilingual (US, male)" },
  { value: "en-US-BrianNeural", label: "Brian (US, male)" },
  { value: "en-US-ChristopherNeural", label: "Christopher (US, male)" },
  { value: "en-US-RogerNeural", label: "Roger (US, male)" },
  { value: "en-US-SteffanNeural", label: "Steffan (US, male)" },
  { value: "en-US-AvaMultilingualNeural", label: "Ava Multilingual (US, female)" },
  { value: "en-US-AvaNeural", label: "Ava (US, female)" },
  { value: "en-US-EmmaMultilingualNeural", label: "Emma Multilingual (US, female)" },
  { value: "en-US-EmmaNeural", label: "Emma (US, female)" },
  { value: "en-US-JennyNeural", label: "Jenny (US, female)" },
  { value: "en-US-MichelleNeural", label: "Michelle (US, female)" },
  { value: "en-US-CoraNeural", label: "Cora (US, female)" },
  { value: "en-US-ElizabethNeural", label: "Elizabeth (US, female)" },
  { value: "en-US-MonicaNeural", label: "Monica (US, female)" },
  { value: "en-US-SaraNeural", label: "Sara (US, female)" },
  { value: "en-US-NancyNeural", label: "Nancy (US, female)" },
  // ── English (UK) ──
  { value: "en-GB-RyanNeural", label: "Ryan (UK, male)" },
  { value: "en-GB-ThomasNeural", label: "Thomas (UK, male)" },
  { value: "en-GB-SoniaNeural", label: "Sonia (UK, female)" },
  { value: "en-GB-LibbyNeural", label: "Libby (UK, female)" },
  { value: "en-GB-MaisieNeural", label: "Maisie (UK, female)" },
  // ── English (Australia) ──
  { value: "en-AU-WilliamNeural", label: "William (AU, male)" },
  { value: "en-AU-DarrenNeural", label: "Darren (AU, male)" },
  { value: "en-AU-DuncanNeural", label: "Duncan (AU, male)" },
  { value: "en-AU-NatashaNeural", label: "Natasha (AU, female)" },
  { value: "en-AU-AnnetteNeural", label: "Annette (AU, female)" },
  { value: "en-AU-CarlyNeural", label: "Carly (AU, female)" },
  { value: "en-AU-EliseNeural", label: "Elise (AU, female)" },
  { value: "en-AU-MadisonNeural", label: "Madison (AU, female)" },
  // ── English (Canada) ──
  { value: "en-CA-LiamNeural", label: "Liam (CA, male)" },
  { value: "en-CA-ClaraNeural", label: "Clara (CA, female)" },
  // ── English (Ireland) ──
  { value: "en-IE-ConnorNeural", label: "Connor (IE, male)" },
  { value: "en-IE-EmilyNeural", label: "Emily (IE, female)" },
  // ── English (India) ──
  { value: "en-IN-PrabhatNeural", label: "Prabhat (IN, male)" },
  { value: "en-IN-NeerjaNeural", label: "Neerja (IN, female)" },
  // ── English (South Africa) ──
  { value: "en-ZA-LukeNeural", label: "Luke (ZA, male)" },
  { value: "en-ZA-LeahNeural", label: "Leah (ZA, female)" },
  // ── Other popular languages ──
  { value: "ja-JP-KeitaNeural", label: "Keita (日本語 JP, male)" },
  { value: "ja-JP-NanamiNeural", label: "Nanami (日本語 JP, female)" },
  { value: "ko-KR-InJoonNeural", label: "InJoon (한국어 KR, male)" },
  { value: "ko-KR-SunHiNeural", label: "Sun-Hi (한국어 KR, female)" },
  { value: "es-ES-AlvaroNeural", label: "Álvaro (Español ES, male)" },
  { value: "es-ES-ElviraNeural", label: "Elvira (Español ES, female)" },
  { value: "fr-FR-HenriNeural", label: "Henri (Français FR, male)" },
  { value: "fr-FR-DeniseNeural", label: "Denise (Français FR, female)" },
  { value: "de-DE-ConradNeural", label: "Conrad (Deutsch DE, male)" },
  { value: "de-DE-KatjaNeural", label: "Katja (Deutsch DE, female)" },
  { value: "pt-BR-AntonioNeural", label: "Antonio (Português BR, male)" },
  { value: "pt-BR-FranciscaNeural", label: "Francisca (Português BR, female)" },
  { value: "hi-IN-MadhurNeural", label: "Madhur (हिन्दी IN, male)" },
  { value: "hi-IN-SwaraNeural", label: "Swara (हिन्दी IN, female)" },
  { value: "zh-CN-YunxiNeural", label: "云希 (中文 CN, male)" },
  { value: "zh-CN-XiaoxiaoNeural", label: "晓晓 (中文 CN, female)" },
];

export function MangaConfig({ manga, onBack, onJobCreated }: MangaConfigProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [chapters, setChapters] = useState<ChapterFeedItem[]>([]);
  const [chapterLoading, setChapterLoading] = useState(true);
  const [language, setLanguage] = useState("en");
  const [chapterLimit, setChapterLimit] = useState(5);
  const [voice, setVoice] = useState("en-US-AndrewNeural");
  const [groqKey, setGroqKey] = useState("");
  const [translate, setTranslate] = useState(true);

  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice preview state
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewVoiceRef = useRef<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Load saved settings + chapter feed on mount.
  useEffect(() => {
    (async () => {
      try {
        const [settingsRes, chaptersRes] = await Promise.all([
          fetch("/api/settings").then((r) => r.json()),
          fetch(`/api/manga/${manga.id}`).then((r) => r.json()),
        ]);
        const s = settingsRes.settings ?? settingsRes;
        setSettings(s);
        setGroqKey(s.groqKey ?? "");
        setVoice(s.defaultVoice ?? "en-US-AndrewNeural");
        setChapterLimit(s.defaultChapterLimit ?? 5);

        const allChapters: ChapterFeedItem[] = chaptersRes.chapters ?? [];
        setChapters(allChapters);

        // Pick the best language: prefer English, else original, else first available.
        const langs = Array.from(new Set(allChapters.map((c) => c.language)));
        const preferred =
          langs.find((l) => l === "en") ||
          langs.find((l) => l === manga.originalLanguage) ||
          langs[0] ||
          "en";
        setLanguage(preferred);
      } catch {
        // non-fatal
      } finally {
        setChapterLoading(false);
      }
    })();
  }, [manga.id, manga.originalLanguage]);

  const availableLanguages = Array.from(new Set(chapters.map((c) => c.language)));
  const filteredChapters = chapters.filter((c) => c.language === language);
  const totalImages = filteredChapters.reduce((s, c) => s + (c.pages ?? 0), 0);
  const effectiveLimit = chapterLimit === 0 ? filteredChapters.length : Math.min(chapterLimit, filteredChapters.length);
  // Estimate: ~3 min per chapter (scrape + VLM + TTS + render)
  const estimatedMinutes = Math.max(1, Math.round(effectiveLimit * 3));
  const estimatedVideoDuration = Math.max(2, Math.round(effectiveLimit * 4));

  const handleStart = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      // Persist settings.
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          groqKey,
          defaultVoice: voice,
          defaultLanguage: language,
          defaultChapterLimit: chapterLimit,
        }),
      });

      // Create job.
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mangaId: manga.id,
          mangaTitle: manga.title,
          coverUrl: manga.coverUrl,
          language,
          chapterLimit,
          voice,
          translate,
          groqKey: groqKey || undefined,
          useBgm: false,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to start job (${res.status})`);
      }
      const data = await res.json();
      onJobCreated(data.job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start");
    } finally {
      setStarting(false);
    }
  }, [groqKey, voice, language, chapterLimit, translate, manga, onJobCreated]);

  // --- Voice preview ---
  // Fetches a short edge-tts sample for the selected voice and plays it.
  // Toggles play/pause if the same voice is already loaded.
  const handlePreview = useCallback(async () => {
    // If we already have this voice loaded, just toggle play/pause.
    if (audioRef.current && previewVoiceRef.current === voice) {
      if (previewPlaying) {
        audioRef.current.pause();
        setPreviewPlaying(false);
      } else {
        try {
          await audioRef.current.play();
          setPreviewPlaying(true);
        } catch {
          setPreviewError("Playback failed — try again.");
        }
      }
      return;
    }

    // Fetch a fresh preview for the current voice.
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewPlaying(false);

    // Stop + clean up any previously loaded audio.
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }

    try {
      const res = await fetch(`/api/voice-preview?voice=${encodeURIComponent(voice)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Preview failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      previewVoiceRef.current = voice;

      audio.onended = () => setPreviewPlaying(false);
      audio.onerror = () => {
        setPreviewError("Playback failed — the audio could not be decoded.");
        setPreviewPlaying(false);
      };

      await audio.play();
      setPreviewPlaying(true);
    } catch (e) {
      setPreviewError(
        e instanceof Error ? e.message : "Failed to load voice preview."
      );
    } finally {
      setPreviewLoading(false);
    }
  }, [voice, previewPlaying]);

  // When the voice selection changes, stop any playing preview and reset state
  // so the next Preview click fetches the new voice.
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    previewVoiceRef.current = null;
    setPreviewPlaying(false);
    setPreviewError(null);
  }, [voice]);

  // Clean up audio + object URL on unmount.
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  return (
    <section className="max-w-5xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to search
      </Button>

      {/* Manga header */}
      <div className="flex flex-col sm:flex-row gap-6 p-6 rounded-xl border border-border bg-card">
        <div className="w-32 sm:w-40 aspect-[3/4] rounded-lg overflow-hidden bg-muted flex-shrink-0 border border-border">
          {manga.coverUrl ? (
            <img src={manga.coverUrl} alt={manga.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              No cover
            </div>
          )}
        </div>
        <div className="flex-1 space-y-3 min-w-0">
          <div>
            <h2 className="text-2xl font-bold leading-tight">{manga.title}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              {manga.year && <Badge variant="secondary">{manga.year}</Badge>}
              {manga.status && <Badge variant="secondary">{manga.status}</Badge>}
              {manga.originalLanguage && (
                <Badge variant="outline">Original: {manga.originalLanguage.toUpperCase()}</Badge>
              )}
              {manga.contentRating && (
                <Badge variant="outline" className="capitalize">{manga.contentRating}</Badge>
              )}
            </div>
          </div>
          {manga.description && (
            <p className="text-sm text-muted-foreground line-clamp-4 leading-relaxed">
              {manga.description}
            </p>
          )}
          {manga.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {manga.tags.slice(0, 8).map((t) => (
                <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Configuration */}
      <div className="p-6 rounded-xl border border-border bg-card space-y-6">
        <div className="flex items-center gap-2">
          <Play className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Pipeline Configuration</h3>
        </div>

        {/* Language */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Globe className="h-4 w-4 text-muted-foreground" />
            Source language
          </Label>
          <Select value={language} onValueChange={setLanguage} disabled={chapterLoading}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {availableLanguages.length === 0 && !chapterLoading && (
                <SelectItem value="en">English (fallback)</SelectItem>
              )}
              {availableLanguages.map((l) => (
                <SelectItem key={l} value={l}>
                  {new Intl.DisplayNames(["en"], { type: "language" }).of(l) ?? l} ({l.toUpperCase()})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {chapterLoading
              ? "Loading available chapters…"
              : `${filteredChapters.length} chapter(s) available in this language${language !== "en" && translate ? " — will be auto-translated to English" : ""}.`}
          </p>
        </div>

        {/* Chapter limit */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              Chapters to process
            </Label>
            <Badge variant="secondary" className="font-mono">
              {chapterLimit === 0 ? "ALL" : `${effectiveLimit} / ${filteredChapters.length}`}
            </Badge>
          </div>
          <Slider
            value={[chapterLimit]}
            onValueChange={([v]) => setChapterLimit(v)}
            min={0}
            max={Math.max(50, filteredChapters.length)}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 = all chapters</span>
            <span>~{totalImages > 0 ? Math.round((effectiveLimit / Math.max(1, filteredChapters.length)) * totalImages) : 0} images to download</span>
          </div>
          {/* Duration estimate card */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 flex-1">
              <Clock className="h-4 w-4 text-sky-400 flex-shrink-0" />
              <div className="space-y-0.5">
                <p className="text-xs font-medium">Estimated processing time</p>
                <p className="text-xs text-muted-foreground">
                  ~{estimatedMinutes} min pipeline · ~{estimatedVideoDuration} min video output
                </p>
              </div>
            </div>
          </div>
          {effectiveLimit > 10 && (
            <p className="text-xs text-amber-400/90 flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Processing {effectiveLimit} chapters may take a long time (scraping + VLM + TTS + rendering per chapter).
            </p>
          )}
        </div>

        <Separator />

        {/* Voice */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Mic2 className="h-4 w-4 text-muted-foreground" />
            Narration voice
          </Label>
          <div className="flex gap-2 items-start">
            <div className="flex-1">
              <Select value={voice} onValueChange={setVoice}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOICES.map((v) => (
                    <SelectItem key={v.value} value={v.value}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handlePreview}
              disabled={previewLoading}
              className="flex-shrink-0 h-9 w-9"
              title={previewLoading ? "Generating preview…" : previewPlaying ? "Stop preview" : "Preview voice"}
              aria-label={previewLoading ? "Generating voice preview" : previewPlaying ? "Stop voice preview" : "Play voice preview"}
            >
              {previewLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : previewPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
          </div>
          {previewError ? (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <Info className="h-3 w-3" />
              {previewError}
            </p>
          ) : previewPlaying ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Volume2 className="h-3 w-3 animate-pulse text-primary" />
              Preview playing…
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Click the speaker icon to hear a sample of the selected voice.
            </p>
          )}
        </div>

        {/* Translate toggle */}
        <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Languages className="h-4 w-4 text-muted-foreground" />
              Auto-translate to English
            </Label>
            <p className="text-xs text-muted-foreground">
              Uses Groq to translate non-English chapter summaries before narration.
            </p>
          </div>
          <Switch checked={translate} onCheckedChange={setTranslate} />
        </div>

        {/* Groq key */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium" htmlFor="groqKey">
            <Key className="h-4 w-4 text-muted-foreground" />
            Groq API key
            <span className="text-xs text-muted-foreground font-normal">(optional — for translation &amp; narration)</span>
          </Label>
          <Input
            id="groqKey"
            type="password"
            value={groqKey}
            onChange={(e) => setGroqKey(e.target.value)}
            placeholder="gsk_…"
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Get a free key at{" "}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              console.groq.com/keys
            </a>
            . Without a key, narration uses the raw VLM summary verbatim (still works, less polished).
          </p>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* No chapters available warning */}
        {!chapterLoading && chapters.length === 0 && (
          <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-2">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-300">No readable chapters available</p>
                <p className="text-xs text-amber-400/80 leading-relaxed">
                  This manga&apos;s chapters are hosted on external sites (MangaDex doesn&apos;t host the images directly), so they can&apos;t be scraped.
                  Try searching for a different version of the same title, or pick a manga that has chapters hosted on MangaDex.
                </p>
              </div>
            </div>
          </div>
        )}
        {!chapterLoading && chapters.length > 0 && filteredChapters.length === 0 && (
          <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 space-y-2">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-300">
                  No chapters in {new Intl.DisplayNames(["en"], { type: "language" }).of(language) ?? language.toUpperCase()}
                </p>
                <p className="text-xs text-amber-400/80">
                  Available languages: {availableLanguages.map((l) => new Intl.DisplayNames(["en"], { type: "language" }).of(l) ?? l.toUpperCase()).join(", ")}. Select a different language above.
                </p>
              </div>
            </div>
          </div>
        )}

        <Button
          size="lg"
          className="w-full font-semibold"
          onClick={handleStart}
          disabled={starting || chapterLoading || filteredChapters.length === 0}
        >
          {starting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Starting pipeline…
            </>
          ) : chapterLoading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Loading chapters…
            </>
          ) : filteredChapters.length === 0 ? (
            <>
              <Info className="h-5 w-5 mr-2" />
              No chapters to process
            </>
          ) : (
            <>
              <Play className="h-5 w-5 mr-2" />
              Start Recap Pipeline
            </>
          )}
        </Button>
      </div>
    </section>
  );
}

