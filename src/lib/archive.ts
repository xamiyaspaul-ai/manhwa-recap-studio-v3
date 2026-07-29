/**
 * archive.ts — Cloud archive orchestrator.
 *
 * Tries Google Drive first (15 GB free). If GDrive isn't configured, is full,
 * or the upload fails, falls back to Mega (20 GB free). If both fail, the
 * local file is kept and an error is thrown.
 *
 * After a successful upload, the local video file is deleted to free disk
 * space. The DB stores which provider has the file + its ID/URL so it can be
 * restored on demand via restoreVideo().
 */

import { promises as fs } from "fs";
import path from "path";
import {
  isGDriveConfigured,
  uploadToGDrive,
  downloadFromGDrive,
  getGDriveQuota,
} from "@/lib/gdrive";
import {
  isMegaConfigured,
  uploadToMega,
  downloadFromMega,
} from "@/lib/mega-storage";
import { DATA_DIR, fileExists } from "@/lib/paths";

export interface ArchiveResult {
  provider: "gdrive" | "mega";
  fileId: string; // GDrive file ID or Mega share URL
}

// Temp restore cache: data/cache/restore/{jobId}.mp4
// Files here are cleaned up after 1 hour (see cleanupRestoreCache).
const RESTORE_CACHE_DIR = path.join(DATA_DIR, "cache", "restore");
const RESTORE_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function isArchiveConfigured(): boolean {
  return isGDriveConfigured() || isMegaConfigured();
}

/**
 * Upload a local video file to cloud storage (GDrive → Mega fallback).
 * Does NOT delete the local file — the caller decides whether to do that.
 */
export async function archiveVideo(
  filePath: string,
  filename: string
): Promise<ArchiveResult> {
  if (!(await fileExists(filePath))) {
    throw new Error(`File not found: ${filePath}`);
  }

  const errors: string[] = [];

  // --- Try Google Drive first ---
  if (isGDriveConfigured()) {
    try {
      // Check quota before uploading (avoid wasting time if full).
      const quota = await getGDriveQuota();
      const stat = await fs.stat(filePath);
      if (quota.available < stat.size + 1024 * 1024) {
        // Less than 1 MB headroom — skip GDrive, try Mega.
        errors.push(
          `Google Drive full (${(quota.available / 1024 / 1024 / 1024).toFixed(1)} GB left, need ${(stat.size / 1024 / 1024).toFixed(0)} MB)`
        );
      } else {
        const fileId = await uploadToGDrive(filePath, filename);
        return { provider: "gdrive", fileId };
      }
    } catch (err) {
      errors.push(
        `Google Drive: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // --- Fallback: Mega ---
  if (isMegaConfigured()) {
    try {
      const shareUrl = await uploadToMega(filePath, filename);
      return { provider: "mega", fileId: shareUrl };
    } catch (err) {
      errors.push(
        `Mega: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // --- Both failed ---
  throw new Error(
    `All archive providers failed.\n${errors.join("\n")}`
  );
}

/**
 * Restore a video from cloud storage to a local temp file.
 * Uses a 1-hour cache so repeat views don't re-download.
 *
 * @param provider - "gdrive" | "mega"
 * @param fileId - GDrive file ID or Mega share URL
 * @param jobId - used for the temp filename
 * @returns absolute path to the restored file
 */
export async function restoreVideo(
  provider: string,
  fileId: string,
  jobId: string
): Promise<string> {
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

  if (provider === "gdrive") {
    await downloadFromGDrive(fileId, tempPath);
  } else if (provider === "mega") {
    await downloadFromMega(fileId, tempPath);
  } else {
    throw new Error(`Unknown archive provider: ${provider}`);
  }

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
