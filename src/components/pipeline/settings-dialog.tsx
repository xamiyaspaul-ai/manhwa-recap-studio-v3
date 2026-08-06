"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

const VOICES = [
  { value: "en-US-AndrewNeural", label: "en-US — Andrew" },
  { value: "en-US-JennyNeural", label: "en-US — Jenny" },
  { value: "en-US-GuyNeural", label: "en-US — Guy" },
  { value: "en-GB-RyanNeural", label: "en-GB — Ryan" },
  { value: "en-AU-WilliamNeural", label: "en-AU — William" },
  { value: "en-IN-NeerjaNeural", label: "en-IN — Neerja" },
  { value: "ja-JP-NanamiNeural", label: "ja-JP — Nanami" },
  { value: "ko-KR-SunHiNeural", label: "ko-KR — SunHi" },
  { value: "es-ES-ElviraNeural", label: "es-ES — Elvira" },
  { value: "zh-CN-XiaoxiaoNeural", label: "zh-CN — Xiaoxiao" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "hi", label: "Hindi" },
  { value: "zh", label: "Chinese" },
];

interface SettingsForm {
  defaultVoice: string;
  defaultChapterLimit: number;
  defaultLanguage: string;
  groqKey: string;
  geminiKey: string;
  openRouterKey: string;
  autoArchive: boolean;
}

const DEFAULTS: SettingsForm = {
  defaultVoice: "en-US-AndrewNeural",
  defaultChapterLimit: 5,
  defaultLanguage: "en",
  groqKey: "",
  geminiKey: "",
  openRouterKey: "",
  autoArchive: false,
};

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SettingsForm>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        const s = data.settings;
        setForm({
          defaultVoice: s.defaultVoice ?? DEFAULTS.defaultVoice,
          defaultChapterLimit: s.defaultChapterLimit ?? DEFAULTS.defaultChapterLimit,
          defaultLanguage: s.defaultLanguage ?? DEFAULTS.defaultLanguage,
          groqKey: s.groqKey ?? "",
          geminiKey: s.geminiKey ?? "",
          openRouterKey: s.openRouterKey ?? "",
          autoArchive: s.autoArchive ?? false,
        });
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadSettings();
  }, [open, loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }
      toast({ title: "Settings saved", description: "Your preferences have been updated." });
      setOpen(false);
    } catch (e) {
      toast({
        title: "Failed to save settings",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        aria-label="Open settings"
      >
        <Settings className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Configure your default pipeline preferences and API keys.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Default Voice */}
              <div className="space-y-2">
                <Label htmlFor="default-voice">Default Voice</Label>
                <Select
                  value={form.defaultVoice}
                  onValueChange={(v) => updateField("defaultVoice", v)}
                >
                  <SelectTrigger id="default-voice" className="w-full">
                    <SelectValue placeholder="Select voice" />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {VOICES.map((v) => (
                      <SelectItem key={v.value} value={v.value}>
                        {v.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Default Chapter Limit */}
              <div className="space-y-2">
                <Label htmlFor="default-chapter-limit">Default Chapter Limit</Label>
                <Input
                  id="default-chapter-limit"
                  type="number"
                  min={0}
                  value={form.defaultChapterLimit}
                  onChange={(e) =>
                    updateField(
                      "defaultChapterLimit",
                      Math.max(0, parseInt(e.target.value, 10) || 0)
                    )
                  }
                />
                <p className="text-xs text-muted-foreground">Set to 0 to process all chapters.</p>
              </div>

              {/* Default Language */}
              <div className="space-y-2">
                <Label htmlFor="default-language">Default Language</Label>
                <Select
                  value={form.defaultLanguage}
                  onValueChange={(v) => updateField("defaultLanguage", v)}
                >
                  <SelectTrigger id="default-language" className="w-full">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        {l.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* API Keys */}
              <div className="space-y-4">
                <p className="text-sm font-medium">API Keys</p>

                <div className="space-y-2">
                  <Label htmlFor="groq-key">Groq API Key</Label>
                  <Input
                    id="groq-key"
                    type="password"
                    placeholder="gsk_..."
                    value={form.groqKey}
                    onChange={(e) => updateField("groqKey", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Faster VLM transcription. Get a free key at console.groq.com/keys
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gemini-key">Gemini API Key</Label>
                  <Input
                    id="gemini-key"
                    type="password"
                    placeholder="AI..."
                    value={form.geminiKey}
                    onChange={(e) => updateField("geminiKey", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Second VLM provider for better transcription reliability.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="openrouter-key">OpenRouter API Key</Label>
                  <Input
                    id="openrouter-key"
                    type="password"
                    placeholder="sk-or-..."
                    value={form.openRouterKey}
                    onChange={(e) => updateField("openRouterKey", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    For narration rewriting via language models.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Auto Archive */}
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-archive">Auto Archive</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically upload completed videos to cloud storage.
                  </p>
                </div>
                <Switch
                  id="auto-archive"
                  checked={form.autoArchive}
                  onCheckedChange={(v) => updateField("autoArchive", v)}
                />
              </div>
            </div>
          )}

          {!loading && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
