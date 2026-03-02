/**
 * Parser for UNC Events Calendar (calendar.unc.edu)
 * Uses the Localist v2 JSON API — no auth required.
 */
import type { ParsedEvent } from "@/lib/ingest/types";

type UnknownRecord = Record<string, unknown>;

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#?\w+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isOnCampus(lat: number, lng: number): boolean {
  return lat >= 35.895 && lat <= 35.925 && lng >= -79.070 && lng <= -79.010;
}

function normalizeEvent(item: UnknownRecord): ParsedEvent[] {
  const event = item.event as UnknownRecord | undefined;
  if (!event) return [];

  const id = event.id != null ? String(event.id) : undefined;
  const title = asString(event.title);
  if (!title) return [];

  const descriptionRaw = asString(event.description_text) ?? asString(event.description);
  const description = descriptionRaw ? stripHtml(descriptionRaw).slice(0, 500) : undefined;

  const locationName = asString(event.location_name) ?? asString(event.location);
  const address = asString(event.address);
  const locationText = locationName
    ? address && !locationName.includes(address) ? `${locationName}, ${address}` : locationName
    : address;

  // Geo
  const geo = event.geo as UnknownRecord | undefined;
  let lat: number | undefined;
  let lng: number | undefined;
  if (geo) {
    const rawLat = parseFloat(String(geo.latitude ?? geo.lat ?? ""));
    const rawLng = parseFloat(String(geo.longitude ?? geo.lng ?? ""));
    if (!isNaN(rawLat) && !isNaN(rawLng) && isOnCampus(rawLat, rawLng)) {
      lat = rawLat;
      lng = rawLng;
    }
  }

  // Category from filters
  let category: string | undefined;
  const filters = event.filters as UnknownRecord | undefined;
  if (filters) {
    const eventTypes = filters.event_types as Array<{ name: string }> | undefined;
    if (eventTypes && eventTypes.length > 0) {
      category = eventTypes[0].name;
    }
  }

  // CLE detection: check description/tags for CLE mentions
  const descRaw = asString(event.description) ?? "";
  const tagsRaw = Array.isArray(event.tags) ? event.tags.join(" ") : "";
  const keywordsRaw = Array.isArray(event.keywords) ? event.keywords.join(" ") : "";
  const cleText = `${descRaw} ${tagsRaw} ${keywordsRaw}`.toLowerCase();
  const isCLE = cleText.includes("cle credit") || cleText.includes("campus life experience") || undefined;

  // Each event can have multiple instances (recurring events)
  const instances = event.event_instances as Array<UnknownRecord> | undefined;
  if (!instances || instances.length === 0) {
    // Fallback: use first_date / last_date
    const startStr = asString(event.first_date);
    if (!startStr) return [];
    const startTime = new Date(startStr);
    if (isNaN(startTime.getTime())) return [];
    const endStr = asString(event.last_date);
    const endTime = endStr ? new Date(endStr) : undefined;

    return [{
      sourceId: id ? `unc-calendar-${id}` : undefined,
      title,
      description,
      startTime,
      endTime: endTime && !isNaN(endTime.getTime()) ? endTime : undefined,
      locationText,
      organizer: asString(event.department_name) ?? undefined,
      category,
      isCLE,
      latitude: lat,
      longitude: lng,
    }];
  }

  // Expand each instance into its own event
  const results: ParsedEvent[] = [];
  for (const inst of instances) {
    const instData = inst.event_instance as UnknownRecord | undefined ?? inst;
    const startStr = asString(instData.start);
    if (!startStr) continue;
    const startTime = new Date(startStr);
    if (isNaN(startTime.getTime())) continue;

    const endStr = asString(instData.end);
    const endTime = endStr ? new Date(endStr) : undefined;

    const instanceId = instData.id != null ? String(instData.id) : id;

    results.push({
      sourceId: instanceId ? `unc-calendar-${instanceId}` : undefined,
      title,
      description,
      startTime,
      endTime: endTime && !isNaN(endTime.getTime()) ? endTime : undefined,
      locationText,
      organizer: asString(event.department_name) ?? undefined,
      category,
      isCLE,
      latitude: lat,
      longitude: lng,
    });
  }

  return results;
}

export async function parseUncCalendar(url: string): Promise<ParsedEvent[]> {
  const allEvents: ParsedEvent[] = [];
  const now = new Date();
  const startDate = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const perPage = 100;
  const maxPages = 10;

  for (let page = 1; page <= maxPages; page++) {
    const apiUrl = `${url}/api/2/events?pp=${perPage}&page=${page}&start=${startDate}&days=30`;

    try {
      const response = await fetch(apiUrl, {
        headers: { "User-Agent": "SignalMapBot/1.0" },
        cache: "no-store",
      });

      if (!response.ok) {
        console.error(`UNC Calendar API returned ${response.status} on page ${page}`);
        break;
      }

      const payload = await response.json() as UnknownRecord;
      const events = payload.events as UnknownRecord[] | undefined;

      if (!events || events.length === 0) break;

      for (const item of events) {
        const parsed = normalizeEvent(item);
        allEvents.push(...parsed);
      }

      // Check if there are more pages
      const pageInfo = payload.page as UnknownRecord | undefined;
      const totalPages = pageInfo?.total ? Number(pageInfo.total) : 1;
      if (page >= totalPages) break;
    } catch (err) {
      console.error(`UNC Calendar fetch error on page ${page}:`, err);
      break;
    }
  }

  console.log(`Fetched ${allEvents.length} events from UNC Events Calendar`);
  return allEvents;
}
