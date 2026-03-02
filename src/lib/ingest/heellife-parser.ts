import type { ParsedEvent } from "@/lib/ingest/types";

type UnknownRecord = Record<string, unknown>;

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseDate(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

/** UNC campus bounding box — reject obviously wrong coordinates */
function isOnCampus(lat: number, lng: number): boolean {
  return lat >= 35.895 && lat <= 35.920 && lng >= -79.065 && lng <= -79.010;
}

function normalizeFromApi(item: UnknownRecord): ParsedEvent | null {
  const sourceId = asString(item.id);
  const title = asString(item.name);
  const startsOn = parseDate(item.startsOn);
  const endsOn = parseDate(item.endsOn);

  if (!title || !startsOn) return null;

  const rawDescription = asString(item.description);
  const description = rawDescription ? stripHtml(rawDescription) : undefined;

  const locationText = asString(item.location);

  // Filter out pure online events
  if (locationText?.toLowerCase() === "online") return null;

  const organizerName = asString(item.organizationName);
  const categoryNames = item.categoryNames;
  const category = Array.isArray(categoryNames) && categoryNames.length > 0
    ? String(categoryNames[0])
    : (asString(item.theme) ?? undefined);

  // CLE detection: categoryIds contains 19455 or categoryNames contains "Campus Life Experience"
  const categoryIds = item.categoryIds;
  const isCLE =
    (Array.isArray(categoryIds) && categoryIds.some((id) => String(id) === "19455")) ||
    (Array.isArray(categoryNames) && categoryNames.some((n) => String(n).toLowerCase().includes("campus life experience")));

  // Extract coordinates if available and valid
  const lat = item.latitude ? parseFloat(String(item.latitude)) : undefined;
  const lng = item.longitude ? parseFloat(String(item.longitude)) : undefined;
  const hasValidCoords = lat !== undefined && lng !== undefined && isOnCampus(lat, lng);

  return {
    sourceId: sourceId ? `heellife-${sourceId}` : undefined,
    title,
    description,
    startTime: startsOn,
    endTime: endsOn,
    locationText,
    organizer: organizerName,
    category,
    isCLE: isCLE || undefined,
    latitude: hasValidCoords ? lat : undefined,
    longitude: hasValidCoords ? lng : undefined,
  };
}

function collectApiItems(data: unknown): UnknownRecord[] {
  if (Array.isArray(data)) return data.filter((v): v is UnknownRecord => typeof v === "object" && v !== null);
  if (!data || typeof data !== "object") return [];

  const root = data as UnknownRecord;
  const candidates = [root.value, root.values, root.items, root.data, root.results, root.events];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((v): v is UnknownRecord => typeof v === "object" && v !== null);
    }
  }

  return [];
}

export async function parseFromHtml(url: string): Promise<ParsedEvent[]> {
  const baseUrl = new URL(url);
  const origin = baseUrl.origin;

  // Only fetch future events, paginate to get enough
  const allEvents: ParsedEvent[] = [];
  const now = new Date().toISOString();
  const take = 100;
  let skip = 0;
  const maxPages = 5;

  for (let page = 0; page < maxPages; page++) {
    const apiUrl = `${origin}/api/discovery/event/search?status=Approved&take=${take}&skip=${skip}&startsAfter=${encodeURIComponent(now)}`;

    try {
      const response = await fetch(apiUrl, {
        headers: { "User-Agent": "SignalMapBot/1.0" },
        cache: "no-store",
      });

      if (!response.ok) break;

      const payload = (await response.json()) as unknown;
      const items = collectApiItems(payload);
      if (items.length === 0) break;

      const events = items
        .map(normalizeFromApi)
        .filter((v): v is ParsedEvent => v !== null);

      allEvents.push(...events);
      skip += take;

      // If we got fewer than requested, we've hit the end
      if (items.length < take) break;
    } catch {
      break;
    }
  }

  console.log(`Fetched ${allEvents.length} events from Heel Life API`);
  return allEvents;
}
