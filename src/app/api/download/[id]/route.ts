import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { outputVideoPath, fileExists } from "@/lib/paths";
import { isR2Configured, getR2Url } from "@/lib/r2";
import { restoreVideo } from "@/lib/archive";

export const dynamic = "force-dynamic";

const VIDEO_MIME = "video/mp4";

/**
 * GET /api/download/{id}
 *
 * Streams the final recap video for a completed job. Supports HTTP Range
 * requests so the <video> element can seek freely.
 *
 * Resolution order:
 *   1. If job.r2Key is set (local file was freed after R2 upload) and R2 is
 *      configured, redirect to a presigned (or public) R2 URL.
 *   2. Otherwise stream the local file at:
 *        a) job.outputDir / job.outputVideo  (absolute path stored at job time)
 *        b) outputVideoPath(jobId)           (fallback: data/jobs/{id}/output/master_recap.mp4)
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Job id is required." }, { status: 400 });
    }

    const job = await db.job.findUnique({
      where: { id },
      select: {
        id: true,
        mangaTitle: true,
        status: true,
        outputDir: true,
        outputVideo: true,
        r2Key: true,
        archiveProvider: true,
        archiveFileId: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const safeTitle = (job.mangaTitle || "recap").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");
    const downloadName = `${safeTitle}_recap.mp4`;

    // ---- 1. R2 redirect (when local file was freed after upload) ------------
    if (job.r2Key && isR2Configured()) {
      try {
        const url = await getR2Url(job.r2Key, 3600);
        return NextResponse.redirect(url, { status: 302 });
      } catch {
        // fall through to local file attempt
      }
    }

    // ---- 2. Resolve local file path ---------------------------------------
    const candidatePaths: string[] = [];
    if (job.outputDir && job.outputVideo) {
      candidatePaths.push(path.join(job.outputDir, job.outputVideo));
    }
    if (job.outputVideo && job.outputVideo !== "master_recap.mp4") {
      // an unusual filename — also try the default dir with that name
      candidatePaths.push(outputVideoPath(job.id, job.outputVideo));
    }
    candidatePaths.push(outputVideoPath(job.id)); // default master_recap.mp4

    let filePath: string | null = null;
    for (const p of candidatePaths) {
      if (await fileExists(p)) {
        filePath = p;
        break;
      }
    }

    if (!filePath) {
      // ---- 2b. Cloud archive restore (GDrive / Mega) -------------------------
      // Local file was freed after archiving — restore from cloud to a temp
      // file, then stream it with Range support. Uses a 1-hour cache so repeat
      // views don't re-download.
      if (job.archiveProvider && job.archiveFileId) {
        try {
          const restoredPath = await restoreVideo(
            job.archiveProvider,
            job.archiveFileId,
            job.id
          );
          filePath = restoredPath;
        } catch (err) {
          return NextResponse.json(
            {
              error: "Failed to restore video from cloud archive.",
              provider: job.archiveProvider,
              detail: err instanceof Error ? err.message : String(err),
            },
            { status: 502 }
          );
        }
      }
    }

    if (!filePath) {
      return NextResponse.json(
        {
          error: "Output video not found.",
          status: job.status,
          hint:
            job.status !== "done"
              ? "Job has not finished rendering yet."
              : job.r2Key
                ? "Video was uploaded to R2 but R2 is not configured on this server."
                : "No local video file and no R2 key.",
        },
        { status: 404 }
      );
    }

    // ---- 3. Stream with Range support -------------------------------------
    const stat = await fs.stat(filePath);
    const fileSize = stat.size;
    const rangeHeader = req.headers.get("range");

    const headers = new Headers();
    headers.set("Content-Type", VIDEO_MIME);
    headers.set("Accept-Ranges", "bytes");
    // Suggest a filename for "Save link as" / download attribute usage.
    headers.set(
      "Content-Disposition",
      `inline; filename="${downloadName}"`
    );
    headers.set("Cache-Control", "no-store");
    headers.set("Cross-Origin-Resource-Policy", "same-origin");

    // No Range header → send the whole file (200).
    if (!rangeHeader) {
      headers.set("Content-Length", String(fileSize));
      const data = await fs.readFile(filePath);
      return new NextResponse(data, { status: 200, headers });
    }

    // Parse "bytes=start-end"
    const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (!match) {
      headers.set("Content-Length", String(fileSize));
      const data = await fs.readFile(filePath);
      return new NextResponse(data, { status: 200, headers });
    }

    let start = match[1] ? parseInt(match[1], 10) : 0;
    let end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
    if (isNaN(start)) start = 0;
    if (isNaN(end) || end >= fileSize) end = fileSize - 1;
    if (start > end || start >= fileSize) {
      headers.set("Content-Range", `bytes */${fileSize}`);
      return new NextResponse(null, { status: 416, headers });
    }

    const chunkSize = end - start + 1;
    const fileHandle = await fs.open(filePath, "r");
    const stream = fileHandle.createReadStream({ start, end });
    // Ensure the file handle is closed when the stream ends/errors.
    stream.on("close", () => {
      fileHandle.close().catch(() => {});
    });
    stream.on("error", () => {
      fileHandle.close().catch(() => {});
    });

    headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    headers.set("Content-Length", String(chunkSize));

    return new NextResponse(stream as unknown as ReadableStream, {
      status: 206,
      headers,
    });
  } catch (err) {
    console.error("[download] error:", err);
    return NextResponse.json(
      { error: "Failed to stream video.", detail: String(err) },
      { status: 500 }
    );
  }
}
