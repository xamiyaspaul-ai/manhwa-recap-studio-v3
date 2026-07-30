/**
 * archive.ts — Cloud archive orchestrator (Mega only).
 *
 * Uploads finished videos to Mega (20 GB free tier) and deletes the local
 * file to free disk space. The DB stores the Mega share URL (which contains
 * the decryption key) so the video can be restored on demand via restoreVideo().
 *
 * If Mega isn't configured or the upload fails, the local file is kept.
 */

import { promises as fs } from "fs";
import path from "path";
import {
  isMegaConfigured,
  uploadToMega,
  downloadFromMega,
} from "@/lib/mega-storage";
import { DATA_DIR, fileExists } from "@/lib/paths";

export interface ArchiveResult {
  provider: "mega";
  fileId: string; // Mega share URL (https://mega.nz/file/...#...)
}

// Temp restore cache: data/cache/restore/{jobId}.mp4
// Files here are cleaned up after 1 hour (see cleanupRestoreCache).
const RESTORE_CACHE_DIR = path.join(DATA_DIR, "cache", "restore");
const RESTORE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function isArchiveConfigured(): boolean {
  return isMegaConfigured();
}

/**
 * Upload a local video file to Mega.
 * Does NOT delete the local file — the caller decides whether to do that.
 */
export async function archiveVideo(
  filePath: string,
  filename: string
): Promise<ArchiveResult> {
  if (!(await fileExists(filePath))) {
    throw new Error(`File not found: ${filePath}`);
  }

  if (!isMegaConfigured()) {
    throw new Error(
      "Mega is not configured. Set MEGA_EMAIL and MEGA_PASSWORD env vars."
    );
  }

  const shareUrl = await uploadToMega(filePath, filename);
  return { provider: "mega", fileId: shareUrl };
}

/**
 * Restore a video from Mega to a local temp file.
 * Uses a 1-hour cache so repeat views don't re-download.
 *
 * @param provider - must be "mega"
 * @param shareUrl - the Mega share URL stored in the DB
 * @param jobId - used for the temp filename
 * @returns absolute path to the restored file
 */
export async function restoreVideo(
  provider: string,
  shareUrl: string,
  jobId: string
): Promise<string> {
  if (provider !== "mega") {
    throw new Error(`Unknown archive provider: ${provider}`);
  }

  await fs.mkdir(RESTORE_CACHE_DIR, { recursive: true });
  const tempPath = path.join(RESTORE_CACHE_DIR, `${jobId}.mp4`);

  // Serve from cache if fresh.
  if (await fileExists(tempPath)) {
    const stat = await fs.stat(tempPath);
    if (Date.now() - stat.mtimeMs < RESTORE_CACHE_TTL_MS && stat.size > 100) {
      return tempPath;
    }
    // Stale — remove and re-download.
    await fs.unlink(tempPath).catch(() => {});
  }

  await downloadFromMega(shareUrl, tempPath);
  return tempPath;
}

/**
 * Delete old files from the restore cache (older than TTL).
 * Call periodically to prevent the cache from growing unbounded.
 */
export async function cleanupRestoreCache(): Promise<number> {
  try {
    const files = await fs.readdir(RESTORE_CACHE_DIR);
    let deleted = 0;
    for (const f of files) {
      const p = path.join(RESTORE_CACHE_DIR, f);
      try {
        const stat = await fs.stat(p);
        if (Date.now() - stat.mtimeMs > RESTORE_CACHE_TTL_MS) {
          await fs.unlink(p);
          deleted++;
        }
      } catch {
        // ignore individual file errors
      }
    }
    return deleted;
  } catch {
    return 0;
  }
}
