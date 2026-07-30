import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/stats — aggregate job metrics for the homepage stats bar. */
export async function GET() {
  try {
    const totalJobs = await db.job.count();
    const completedJobs = await db.job.count({ where: { status: "done" } });
    const totalChapters = await db.chapter.count();
    const totalImages = await db.job.aggregate({ _sum: { totalImages: true } });

    return NextResponse.json({
      totalJobs,
      completedJobs,
      totalChapters,
      totalImages: totalImages._sum.totalImages ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to load stats: ${message}` },
      { status: 500 }
    );
  }
}
