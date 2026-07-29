import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { fileExists, ensureDir } from "@/lib/paths";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PYTHON_BIN = process.env.PYTHON_BIN || "python3";
const PREVIEW_SCRIPT = path.join(process.cwd(), "pipeline", "voice_preview.py");
const CACHE_DIR = path.join(process.cwd(), "data", "cache", "voice-preview");

// Voice IDs look like "en-US-AndrewNeural", "ja-JP-KeitaNeural", etc.
const VOICE_ID_RE = /^[a-z]{2}-[A-Z]{2}-[A-Za-z0-9]+Neural$/;

/**
 * GET /api/voice-preview?voice={voiceId}
 *
 * Generates (or serves from cache) a short ~4-second voice preview MP3
 * using the same edge-tts engine the pipeline uses. This lets users hear
 * how a narration voice sounds before starting a job.
 *
 * Preview samples are cached indefinitely per voice (they never change).
 */
export async function GET(req: NextRequest) {
  const voice = req.nextUrl.searchParams.get("voice");

  if (!voice || !VOICE_ID_RE.test(voice)) {
    return NextResponse.json(
      { error: "Invalid or missing 'voice' parameter. Expected format like 'en-US-AndrewNeural'." },
      { status: 400 }
    );
  }

  const cacheFile = path.join(CACHE_DIR, `${voice}.mp3`);

  try {
    // --- 1. Serve from cache if available ---
    if (await fileExists(cacheFile)) {
      const stat = await fs.stat(cacheFile);
      if (stat.size > 100) {
        const data = await fs.readFile(cacheFile);
        return new NextResponse(data, {
          status: 200,
          headers: {
            "Content-Type": "audio/mpeg",
            "Content-Length": String(stat.size),
            "Cache-Control": "public, max-age=86400, immutable",
          },
        });
      }
      // Corrupt/empty cache file — remove and regenerate
      await fs.unlink(cacheFile).catch(() => {});
    }

    // --- 2. Generate via Python edge-tts ---
    await ensureDir(CACHE_DIR);

    const result = spawnSync(
      PYTHON_BIN,
      [PREVIEW_SCRIPT, "--voice", voice, "--output", cacheFile],
      {
        encoding: "utf8",
        timeout: 25000,
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      }
    );

    if (result.status !== 0 || !(await fileExists(cacheFile))) {
      const stderr = (result.stderr || "").slice(-300);
      console.error("[voice-preview] generation failed for", voice, stderr);
      return NextResponse.json(
        { error: "Failed to generate voice preview. This voice may not be available.", detail: stderr },
        { status: 502 }
      );
    }

    // --- 3. Serve the freshly generated file ---
    const data = await fs.readFile(cacheFile);
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(data.length),
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err) {
    console.error("[voice-preview] error:", err);
    return NextResponse.json(
      { error: "Internal error generating voice preview." },
      { status: 500 }
    );
  }
}
