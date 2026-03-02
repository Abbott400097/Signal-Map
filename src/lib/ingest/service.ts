import { prisma } from "@/lib/prisma";
import { normalizeEvents } from "@/lib/ingest/normalizer";
import { parseFromHtml } from "@/lib/ingest/heellife-parser";
import { parseUncCalendar } from "@/lib/ingest/unc-calendar-parser";
import { parseCPA } from "@/lib/ingest/cpa-parser";
import { parseIcalFeed } from "@/lib/ingest/ical-parser";
import type { ParsedEvent } from "@/lib/ingest/types";

type IngestResult = {
  sourceId: string;
  sourceName: string;
  newCount: number;
  updatedCount: number;
  errorCount: number;
};

/** Dispatch to the right parser based on parserType */
async function fetchEvents(parserType: string, url: string): Promise<ParsedEvent[]> {
  switch (parserType) {
    case "HEELLIFE":
      return parseFromHtml(url);
    case "LOCALIST":
      return parseUncCalendar(url);
    case "WP_EVENTS":
      return parseCPA(url);
    case "ICAL_LIBRARIES":
      return parseIcalFeed(url, "lib", "Library", "UNC Libraries");
    case "ICAL_ATHLETICS":
      return parseIcalFeed(url, "athletics", "Athletics", "UNC Athletics");
    default:
      // Fallback: try generic iCal
      if (url.endsWith(".ics") || url.includes("ical")) {
        return parseIcalFeed(url, parserType.toLowerCase(), undefined, undefined);
      }
      console.warn(`Unknown parserType "${parserType}" for ${url}, skipping`);
      return [];
  }
}

export async function ingestSource(sourceId: string): Promise<IngestResult> {
  const source = await prisma.eventSource.findUnique({ where: { id: sourceId } });
  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  let newCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  try {
    console.log(`\n▸ Ingesting: ${source.name} (${source.parserType})`);
    const parsed = await fetchEvents(source.parserType, source.url);
    const normalized = await normalizeEvents(parsed);

    const matched = normalized.filter((e) => e.buildingId).length;
    console.log(`  ${parsed.length} parsed → ${matched}/${normalized.length} matched to buildings`);

    for (const item of normalized) {
      const dedupeSourceId = item.sourceId;
      if (dedupeSourceId) {
        const existing = await prisma.event.findFirst({
          where: { sourceId: dedupeSourceId }
        });

        if (existing) {
          await prisma.event.update({
            where: { id: existing.id },
            data: {
              title: item.title,
              description: item.description,
              startTime: item.startTime,
              endTime: item.endTime,
              buildingId: item.buildingId,
              locationText: item.locationText,
              organizer: item.organizer,
              category: item.category,
              isCLE: item.isCLE ?? false,
              sourceRef: source.id
            }
          });
          updatedCount += 1;
          continue;
        }
      }

      await prisma.event.create({
        data: {
          sourceId: item.sourceId,
          title: item.title,
          description: item.description,
          startTime: item.startTime,
          endTime: item.endTime,
          buildingId: item.buildingId,
          locationText: item.locationText,
          organizer: item.organizer,
          category: item.category,
          isCLE: item.isCLE ?? false,
          sourceRef: source.id
        }
      });
      newCount += 1;
    }

    await prisma.eventSource.update({
      where: { id: source.id },
      data: { lastSuccessAt: new Date(), lastError: null }
    });

    console.log(`  ✓ ${newCount} new, ${updatedCount} updated`);
  } catch (error) {
    errorCount += 1;
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`  ✗ Error: ${msg}`);
    await prisma.eventSource.update({
      where: { id: source.id },
      data: { lastError: msg }
    });
  }

  await prisma.ingestLog.create({
    data: {
      sourceId: source.id,
      newCount,
      updatedCount,
      errorCount,
      rawError: errorCount ? "Ingest failed, check event source details" : null
    }
  });

  return {
    sourceId: source.id,
    sourceName: source.name,
    newCount,
    updatedCount,
    errorCount
  };
}

export async function ingestAllSources() {
  console.log("═══ SignalMap Ingest ═══");
  const sources = await prisma.eventSource.findMany({ select: { id: true } });
  const results = [];

  for (const source of sources) {
    const result = await ingestSource(source.id);
    results.push(result);
  }

  const totalNew = results.reduce((s, r) => s + r.newCount, 0);
  const totalUpdated = results.reduce((s, r) => s + r.updatedCount, 0);
  console.log(`\n═══ Done: ${totalNew} new, ${totalUpdated} updated across ${results.length} sources ═══\n`);

  return results;
}
