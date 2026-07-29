#!/usr/bin/env python3
"""
voice_preview.py — Generate a short voice preview sample using edge-tts.

Used by the Next.js /api/voice-preview route to let users hear how a
narration voice sounds before starting the pipeline.

Usage:
    python voice_preview.py --voice en-US-AndrewNeural --output /path/to/preview.mp3
"""
from __future__ import annotations

import argparse
import asyncio
import sys
import os

SAMPLE_TEXT = (
    "Hello! I'll be narrating your manhwa recap video. "
    "This is a quick preview of how my voice sounds. "
    "Let's dive into the story!"
)


async def generate(voice: str, text: str, output: str) -> None:
    import edge_tts

    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a voice preview MP3")
    parser.add_argument("--voice", required=True, help="edge-tts voice id (e.g. en-US-AndrewNeural)")
    parser.add_argument("--output", required=True, help="output MP3 file path")
    parser.add_argument("--text", default=SAMPLE_TEXT, help="sample text to speak")
    args = parser.parse_args()

    try:
        asyncio.run(generate(args.voice, args.text, args.output))
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1

    # Verify the file was created and is non-empty
    if not os.path.exists(args.output) or os.path.getsize(args.output) < 100:
        print("ERROR: edge-tts produced an empty or missing file", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
