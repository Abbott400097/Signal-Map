/**
 * Generic iCal (.ics) parser — no external dependencies.
 * Parses VEVENT blocks into ParsedEvent objects.
 * Used for UNC Libraries and UNC Athletics feeds.
 */
import type { ParsedEvent } from "@/lib/ingest/types";

type VEvent = {
  uid?: string;
  summary?: string;
  description?: string;
  dtstart?: string;
  dtend?: string;
  location?: string;
  url?: string;
  organizer?: string;
  categories?: string;
  geo?: string;
};

function unfoldLines(raw: string): string {
  // iCal "folding": a long line is split by CRLF + space/tab
  return raw.replace(/\r?\n[ \t]/g, "");
}

function unescapeIcal(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}

function parseIcalDate(value: string): Date | undefined {
  // Formats: 20260301T190000Z, 20260301T190000, 20260301, TZID=...:20260301T190000
  let cleaned = value;

  // Strip TZID prefix
  const tzidMatch = cleaned.match(/^(?:TZID=[^:]+:)?(.+)$/);
  if (tzidMatch) cleaned = tzidMatch[1];

  // VALUE=DATE:20260301
  const valueDateMatch = cleaned.match(/^(?:VALUE=DATE:)?(\d{8})$/);
  if (valueDateMatch) {
    const d = valueDateMatch[1];
    return new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T00:00:00`);
  }

  // 20260301T190000Z or 20260301T190000
  const dtMatch = cleaned.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (dtMatch) {
    const [, y, mo, d, h, mi, s, z] = dtMatch;
    const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${z ? "Z" : ""}`;
    const date = new Date(iso);
    return isNaN(date.getTime()) ? undefined : date;
  }

  // Fallback: try native parsing
  const date = new Date(cleaned);
  return isNaN(date.getTime()) ? undefined : date;
}

function parseVEvents(ical: string): VEvent[] {
  const unfolded = unfoldLines(ical);
  const lines = unfolded.split(/\r?\n/);
  const events: VEvent[] = [];
  let current: VEvent | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx < 0) continue;

    let key = line.slice(0, colonIdx).toUpperCase();
    const value = line.slice(colonIdx + 1);

    // Strip parameters from key (e.g., DTSTART;TZID=America/New_York)
    const semiIdx = key.indexOf(";");

    // For DTSTART/DTEND, preserve TZID info in value
    if (semiIdx >= 0) {
      const params = key.slice(semiIdx + 1);
      key = key.slice(0, semiIdx);
      if ((key === "DTSTART" || key === "DTEND") && params.startsWith("TZID=")) {
        // Prepend TZID to value for parsing
        current[key.toLowerCase() as keyof VEvent] = `${params}:${value}`;
        continue;
      }
    }

    switch (key) {
      case "UID": current.uid = value; break;
      case "SUMMARY": current.summary = unescapeIcal(value); break;
      case "DESCRIPTION": current.description = unescapeIcal(value); break;
      case "DTSTART": current.dtstart = value; break;
      case "DTEND": current.dtend = value; break;
      case "LOCATION": current.location = unescapeIcal(value); break;
      case "URL": current.url = value; break;
      case "ORGANIZER": current.organizer = value; break;
      case "CATEGORIES": current.categories = unescapeIcal(value); break;
      case "GEO": current.geo = value; break;
    }
  }

  return events;
}

function isOnCampus(lat: number, lng: number): boolean {
  return lat >= 35.890 && lat <= 35.930 && lng >= -79.075 && lng <= -79.005;
}

export async function parseIcalFeed(
  url: string,
  sourcePrefix: string,
  defaultCategory?: string,
  defaultOrganizer?: string,
): Promise<ParsedEvent[]> {
  let icalText: string;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "SignalMapBot/1.0" },
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`iCal feed returned ${response.status}: ${url}`);
      return [];
    }
    icalText = await response.text();
  } catch (err) {
    console.error(`iCal fetch error for ${url}:`, err);
    return [];
  }

  const vevents = parseVEvents(icalText);
  const now = new Date();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // Allow events from yesterday
  const results: ParsedEvent[] = [];

  for (const ve of vevents) {
    if (!ve.summary) continue;

    const startTime = ve.dtstart ? parseIcalDate(ve.dtstart) : undefined;
    if (!startTime) continue;

    // Skip past events
    const endTime = ve.dtend ? parseIcalDate(ve.dtend) : undefined;
    const relevantEnd = endTime ?? startTime;
    if (relevantEnd < cutoff) continue;

    // Only include events within next 30 days
    const maxFuture = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (startTime > maxFuture) continue;

    // Parse geo if available
    let lat: number | undefined;
    let lng: number | undefined;
    if (ve.geo) {
      const parts = ve.geo.split(";");
      if (parts.length === 2) {
        const geoLat = parseFloat(parts[0]);
        const geoLng = parseFloat(parts[1]);
        if (!isNaN(geoLat) && !isNaN(geoLng) && isOnCampus(geoLat, geoLng)) {
          lat = geoLat;
          lng = geoLng;
        }
      }
    }

    const description = ve.description
      ? ve.description.replace(/\n+/g, " ").slice(0, 500)
      : undefined;

    results.push({
      sourceId: ve.uid ? `${sourcePrefix}-${ve.uid}` : undefined,
      title: ve.summary,
      description,
      startTime,
      endTime: endTime && !isNaN(endTime.getTime()) ? endTime : undefined,
      locationText: ve.location ?? undefined,
      organizer: defaultOrganizer ?? ve.organizer ?? undefined,
      category: ve.categories ?? defaultCategory ?? undefined,
      latitude: lat,
      longitude: lng,
    });
  }

  console.log(`Fetched ${results.length} events from iCal feed: ${url}`);
  return results;
}
