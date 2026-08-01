#!/usr/bin/env python3
"""
youtube_optimize.py — YouTube-ready video optimization + thumbnail generation.

Does two things using only free, local tools (ffmpeg + PIL):
1. Re-encodes the final video to YouTube's recommended specs:
   - H.264 video, AAC audio, MP4 container
   - -movflags +faststart (web-optimized streaming)
   - 1920x1080, 24fps, 8-12 Mbps bitrate
   - 44.1kHz AAC audio at 192k
2. Generates a YouTube thumbnail (1280x720 JPG):
   - Uses the manga cover image (or first panel if no cover)
   - Adds the manga title as a text overlay
   - Adds "Manhwa Recap" branding

Usage:
    python youtube_optimize.py --video /path/to/video.mp4 --title "Nano Machine" --cover /path/to/cover.jpg --output-dir /path/to/output
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


def generate_thumbnail(title: str, cover_path: str | None, output_path: str) -> bool:
    """Generate a YouTube thumbnail (1280x720 JPG) with title overlay.

    Uses PIL (Pillow) — free, local, no API calls.
    """
    from PIL import Image, ImageDraw, ImageFont

    THUMB_W, THUMB_H = 1280, 720

    # Background: use the cover image if available, else a gradient
    if cover_path and Path(cover_path).exists():
        try:
            bg = Image.open(cover_path).convert("RGB")
            # Cover-fit the image to fill 1280x720
            bg_ratio = bg.width / bg.height
            thumb_ratio = THUMB_W / THUMB_H
            if bg_ratio > thumb_ratio:
                # Image is wider — crop sides
                new_w = int(bg.height * thumb_ratio)
                left = (bg.width - new_w) // 2
                bg = bg.crop((left, 0, left + new_w, bg.height))
            else:
                # Image is taller — crop top/bottom
                new_h = int(bg.width / thumb_ratio)
                top = (bg.height - new_h) // 2
                bg = bg.crop((0, top, bg.width, top + new_h))
            bg = bg.resize((THUMB_W, THUMB_H), Image.LANCZOS)
        except Exception as e:
            print(f"[YT] Failed to load cover, using gradient: {e}", file=sys.stderr)
            bg = Image.new("RGB", (THUMB_W, THUMB_H), "#1a1a2e")
    else:
        bg = Image.new("RGB", (THUMB_W, THUMB_H), "#1a1a2e")

    # Darken the bottom half for text readability
    overlay = Image.new("RGBA", (THUMB_W, THUMB_H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    # Gradient overlay from transparent (top) to dark (bottom)
    for y in range(THUMB_H):
        alpha = int(180 * (y / THUMB_H) ** 2)
        draw.line([(0, y), (THUMB_W, y)], fill=(0, 0, 0, alpha))
    bg = Image.alpha_composite(bg.convert("RGBA"), overlay).convert("RGB")

    draw = ImageDraw.Draw(bg)

    # Load fonts (try several paths)
    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    ]
    title_font = None
    sub_font = None
    for fp in font_paths:
        if Path(fp).exists():
            title_font = ImageFont.truetype(fp, 56)
            sub_font = ImageFont.truetype(fp, 28)
            break
    if not title_font:
        title_font = ImageFont.load_default()
        sub_font = ImageFont.load_default()

    # Draw title text (bottom-left, wrapped)
    title_y = THUMB_H - 180
    # Simple word-wrap
    words = title.split()
    lines = []
    current_line = ""
    for word in words:
        test = f"{current_line} {word}".strip()
        bbox = draw.textbbox((0, 0), test, font=title_font)
        if bbox[2] - bbox[0] > THUMB_W - 80 and current_line:
            lines.append(current_line)
            current_line = word
        else:
            current_line = test
    if current_line:
        lines.append(current_line)

    # Draw each line with a shadow for readability
    for i, line in enumerate(lines[:2]):  # Max 2 lines
        y = title_y + i * 65
        # Shadow
        draw.text((41, y + 1), line, fill=(0, 0, 0), font=title_font)
        # Text
        draw.text((40, y), line, fill=(255, 255, 255), font=title_font)

    # Draw "Manhwa Recap" branding (top-right)
    branding = "MANHWA RECAP"
    bbox = draw.textbbox((0, 0), branding, font=sub_font)
    bx = THUMB_W - bbox[2] - 30
    # Background pill for branding
    draw.rounded_rectangle(
        [bx - 15, 20, bx + bbox[2] + 15, 20 + bbox[3] + 15],
        radius=8, fill=(220, 38, 38),
    )
    draw.text((bx, 28), branding, fill=(255, 255, 255), font=sub_font)

    # Save as JPG (YouTube requires JPG or PNG, under 2MB)
    bg.save(output_path, "JPEG", quality=90)
    size_kb = os.path.getsize(output_path) / 1024
    print(f"[YT] Thumbnail saved: {output_path} ({size_kb:.0f} KB)")
    return True


def optimize_for_youtube(input_path: str, output_path: str) -> bool:
    """Re-encode video to YouTube's recommended specs.

    YouTube recommends:
    - Container: MP4
    - Video codec: H.264 (High profile)
    - Audio codec: AAC, 44.1kHz or 48kHz, 128-384 kbps
    - Resolution: 1920x1080 (or 1280x720)
    - Frame rate: 24, 25, 30, 48, 50, or 60 fps
    - Bitrate: 8-12 Mbps for 1080p (standard), 35-45 Mbps for 4K
    - faststart: yes (moov atom at beginning for streaming)
    """
    cmd = [
        "ffmpeg", "-y",
        "-i", input_path,
        # Video: H.264 high profile, 1080p, 24fps, 10Mbps
        "-c:v", "libx264",
        "-profile:v", "high",
        "-level", "4.2",
        "-preset", "medium",  # better compression than ultrafast
        "-crf", "18",  # high quality (lower = better, 18 = visually lossless)
        "-pix_fmt", "yuv420p",
        "-r", "24",
        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
        # Audio: AAC, 44.1kHz, 192k
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "44100",
        "-ac", "2",
        # MP4 with faststart (web-optimized)
        "-movflags", "+faststart",
        "-f", "mp4",
        output_path,
    ]

    print(f"[YT] Optimizing video for YouTube...")
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=600)

    if result.returncode != 0:
        print(f"[YT] ffmpeg failed: {result.stderr[-500:]}", file=sys.stderr)
        return False

    size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"[YT] Optimized video saved: {output_path} ({size_mb:.1f} MB)")
    return True


def generate_youtube_metadata(title: str, chapter_count: int, total_images: int) -> dict:
    """Generate YouTube-ready title, description, and tags."""
    # Title: catchy, under 100 chars
    yt_title = f"{title} - Full Manhwa Recap | Chapters 1-{chapter_count}"

    # Description
    description = f"""{title} Manhwa Recap

📖 Manga: {title}
🎬 Chapters covered: {chapter_count}
🖼️ Total panels: {total_images}

This is an AI-generated recap video of the manhwa "{title}". The video uses:
- VLM (Vision Language Model) to read and transcribe panel text
- edge-tts neural text-to-speech for narration
- YOLO panel detection for precise panel slicing
- ffmpeg for video rendering

⚠️ This video is for personal/educational purposes only. All artwork belongs to the original creators and scanlation team.

#manhwa #recap #manga #webtoon #{title.replace(" ", "")} #manhwarecap"""

    # Tags
    tags = [
        title.lower(),
        "manhwa",
        "manga recap",
        "manhwa recap",
        "webtoon",
        f"{title.lower()} recap",
        "manhwa summary",
        "manga summary",
        "ai narration",
        "text to speech",
        "comic recap",
    ]

    return {
        "title": yt_title[:100],  # YouTube title limit
        "description": description,
        "tags": tags,
        "category": "24",  # Entertainment
        "privacyStatus": "private",  # Start private, user publishes when ready
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="YouTube-optimize video + generate thumbnail")
    parser.add_argument("--video", required=True, help="Input video MP4 path")
    parser.add_argument("--title", required=True, help="Manga title for thumbnail + metadata")
    parser.add_argument("--cover", default=None, help="Cover image path for thumbnail")
    parser.add_argument("--chapters", type=int, default=1, help="Number of chapters")
    parser.add_argument("--images", type=int, default=0, help="Total panel images")
    parser.add_argument("--output-dir", required=True, help="Output directory")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    video_path = args.video
    if not Path(video_path).exists():
        print(f"ERROR: video not found: {video_path}", file=sys.stderr)
        return 1

    # 1. Generate thumbnail
    thumb_path = str(output_dir / "thumbnail.jpg")
    print("[YT] Step 1: Generating thumbnail...")
    generate_thumbnail(args.title, args.cover, thumb_path)

    # 2. Optimize video for YouTube
    yt_video_path = str(output_dir / "youtube_ready.mp4")
    print("[YT] Step 2: Optimizing video for YouTube...")
    optimize_for_youtube(video_path, yt_video_path)

    # 3. Generate YouTube metadata
    print("[YT] Step 3: Generating YouTube metadata...")
    metadata = generate_youtube_metadata(args.title, args.chapters, args.images)
    metadata_path = output_dir / "youtube_metadata.json"
    metadata_path.write_text(json.dumps(metadata, indent=2, ensure_ascii=False), encoding="utf-8")

    print(f"\n[YT] === YouTube-Ready Output ===")
    print(f"[YT] Video:      {yt_video_path}")
    print(f"[YT] Thumbnail:  {thumb_path}")
    print(f"[YT] Metadata:   {metadata_path}")
    print(f"[YT] Title:      {metadata['title']}")
    print(f"[YT] Tags:       {', '.join(metadata['tags'][:5])}...")
    print(f"[YT] All done! Upload to YouTube Studio.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
