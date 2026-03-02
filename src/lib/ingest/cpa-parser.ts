/**
 * Parser for Carolina Performing Arts (carolinaperformingarts.org)
 * Uses the WordPress REST API — events as custom post type.
 */
import type { ParsedEvent } from "@/lib/ingest/types";

type WPEvent = {
  id: number;
  date: string;
  title: { rendered: string };
  content: { rendered: string };
  link: string;
  slug: string;
  class_list?: string[];
  yoast_head_json?: {
    schema?: {
      "@graph"?: Array<{
        "@type"?: string | string[];
        startDate?: string;
        endDate?: string;
        location?: { name?: string; address?: { streetAddress?: string } };
        name?: string;
      }>;
    };
  };
};

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

function extractDateFromContent(html: string): { start?: Date; end?: Date } {
  // Try to find date patterns in content like "Friday, March 14, 2025 at 7:30 PM"
  const datePattern = /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\w+ \d{1,2},?\s+\d{4})\s+(?:at\s+)?(\d{1,2}:\d{2}\s*[AP]M)?/i;
  const match = html.match(datePattern);
  if (match) {
    const dateStr = match[1] + (match[2] ? ` ${match[2]}` : "");
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return { start: d, end: undefined };
    }
  }
  return {};
}

// Memorial Hall coordinates (main CPA venue)
const MEMORIAL_HALL = { lat: 35.9117, lng: -79.0506 };

function normalizeEvent(item: WPEvent): ParsedEvent | null {
  const title = stripHtml(item.title.rendered);
  if (!title) return null;

  const contentText = stripHtml(item.content.rendered);
  const description = contentText.slice(0, 500) || undefined;

  // Try to extract dates from Schema.org data
  let startTime: Date | undefined;
  let endTime: Date | undefined;

  const graph = item.yoast_head_json?.schema?.["@graph"];
  if (graph) {
    for (const node of graph) {
      const nodeType = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
      if (nodeType.some((t) => t === "Event" || t === "MusicEvent" || t === "TheaterEvent")) {
        if (node.startDate) startTime = new Date(node.startDate);
        if (node.endDate) endTime = new Date(node.endDate);
        break;
      }
    }
  }

  // Fallback: parse from content or use post date
  if (!startTime || isNaN(startTime.getTime())) {
    const extracted = extractDateFromContent(item.content.rendered);
    startTime = extracted.start;
    endTime = extracted.end;
  }

  // Last resort: use post date (at least we show it somewhere)
  if (!startTime || isNaN(startTime.getTime())) {
    startTime = new Date(item.date);
  }

  if (!startTime || isNaN(startTime.getTime())) return null;

  // Skip past events
  if (startTime < new Date(Date.now() - 24 * 60 * 60 * 1000)) return null;

  // Location — most CPA events are at Memorial Hall or Gerrard Hall
  let locationText = "Memorial Hall";
  const content = item.content.rendered.toLowerCase();
  if (content.includes("gerrard hall")) {
    locationText = "Gerrard Hall";
  } else if (content.includes("playmakers")) {
    locationText = "Paul Green Theatre";
  } else if (content.includes("forest theatre")) {
    locationText = "Forest Theatre";
  }

  return {
    sourceId: `cpa-${item.id}`,
    title,
    description,
    startTime,
    endTime: endTime && !isNaN(endTime.getTime()) ? endTime : undefined,
    locationText,
    organizer: "Carolina Performing Arts",
    category: "Performance",
    latitude: MEMORIAL_HALL.lat,
    longitude: MEMORIAL_HALL.lng,
  };
}

export async function parseCPA(url: string): Promise<ParsedEvent[]> {
  const allEvents: ParsedEvent[] = [];
  const perPage = 100;
  const maxPages = 3;

  for (let page = 1; page <= maxPages; page++) {
    const apiUrl = `${url}/wp-json/wp/v2/event?per_page=${perPage}&page=${page}&orderby=date&order=asc`;

    try {
      const response = await fetch(apiUrl, {
        headers: { "User-Agent": "SignalMapBot/1.0" },
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 400) break; // No more pages
        console.error(`CPA API returned ${response.status} on page ${page}`);
        break;
      }

      const items = (await response.json()) as WPEvent[];
      if (items.length === 0) break;

      for (const item of items) {
        const parsed = normalizeEvent(item);
        if (parsed) allEvents.push(parsed);
      }

      // Check total pages
      const totalPages = parseInt(response.headers.get("X-WP-TotalPages") ?? "1", 10);
      if (page >= totalPages) break;
    } catch (err) {
      console.error(`CPA fetch error on page ${page}:`, err);
      break;
    }
  }

  console.log(`Fetched ${allEvents.length} events from Carolina Performing Arts`);
  return allEvents;
}
