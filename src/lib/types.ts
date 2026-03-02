export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export type BuildingSummary = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  campus: "NORTH" | "SOUTH" | "OTHER";
  aliases: string[];
  eventCount: number;
  heatLevel: HeatLevel;
  happeningNowCount: number;
  nextEventStartsAt: string | null;
  cleCount: number;
};

export type EventSummary = {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  locationText: string | null;
  organizer: string | null;
  category: string | null;
  status: "ACTIVE" | "CANCELLED";
  buildingId: string | null;
};

export type BuildingEventsPayload = {
  building: BuildingSummary;
  now: EventSummary[];
  upcoming: EventSummary[];
};
