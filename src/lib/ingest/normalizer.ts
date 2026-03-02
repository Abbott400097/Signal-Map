import { prisma } from "@/lib/prisma";
import type { ParsedEvent } from "@/lib/ingest/types";

function simplify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Haversine distance in meters */
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type BuildingRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  aliases: string;
};

/** Common abbreviations used in event location text */
const ABBREVIATIONS: Record<string, string> = {
  "gl": "greenlaw",
  "dey": "dey hall",
  "ch": "carolina hall",
  "sa": "student union",
  "su": "student union",
  "mh": "memorial hall",
  "gb": "genome sciences building",
  "fd": "fetzer",
};

export async function resolveBuildingId(
  locationText: string | undefined,
  lat: number | undefined,
  lng: number | undefined,
  buildings: BuildingRow[]
): Promise<string | undefined> {
  // Strategy 1: Match by name/alias
  if (locationText) {
    const source = simplify(locationText);
    for (const building of buildings) {
      const aliases: string[] = JSON.parse(building.aliases);
      const labels = [building.name, ...aliases];
      if (labels.some((alias) => source.includes(simplify(alias)))) {
        return building.id;
      }
    }

    // Strategy 1b: Check abbreviation prefix (e.g. "GL-0104" → "greenlaw")
    const prefixMatch = locationText.match(/^([A-Za-z]{2,4})[\s\-]/);
    if (prefixMatch) {
      const abbr = prefixMatch[1].toLowerCase();
      const expanded = ABBREVIATIONS[abbr];
      if (expanded) {
        for (const building of buildings) {
          if (simplify(building.name).includes(simplify(expanded))) {
            return building.id;
          }
        }
      }
    }
  }

  // Strategy 2: Match by coordinates (find nearest building within 100m)
  if (lat !== undefined && lng !== undefined) {
    let bestId: string | undefined;
    let bestDist = 100; // max 100 meters

    for (const building of buildings) {
      const dist = distanceMeters(lat, lng, building.lat, building.lng);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = building.id;
      }
    }

    return bestId;
  }

  return undefined;
}

export async function normalizeEvents(events: ParsedEvent[]) {
  const buildings = await prisma.building.findMany({
    select: { id: true, name: true, lat: true, lng: true, aliases: true },
  });

  const normalized = [] as Array<ParsedEvent & { buildingId?: string }>;

  for (const event of events) {
    const buildingId = await resolveBuildingId(
      event.locationText,
      event.latitude,
      event.longitude,
      buildings
    );
    normalized.push({ ...event, buildingId });
  }

  return normalized;
}
