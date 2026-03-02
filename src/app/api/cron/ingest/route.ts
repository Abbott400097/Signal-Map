import { NextResponse } from "next/server";
import { ingestAllSources } from "@/lib/ingest/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // allow up to 60s for ingestion

/**
 * GET /api/cron/ingest
 *
 * Triggers a full ingest of all event sources.
 * Can be called by:
 *   - Vercel Cron (vercel.json)
 *   - External cron (curl)
 *   - Internal background trigger from page load
 */
export async function GET() {
  try {
    const results = await ingestAllSources();
    const totalNew = results.reduce((s, r) => s + r.newCount, 0);
    const totalUpdated = results.reduce((s, r) => s + r.updatedCount, 0);

    return NextResponse.json({
      ok: true,
      sources: results.length,
      newEvents: totalNew,
      updatedEvents: totalUpdated,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
