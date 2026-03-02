import { addDays, endOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { HeatLevel } from "@/lib/types";

export async function getBuildingEventsWindow(buildingId: string, days = 3) {
  const now = new Date();
  const until = addDays(now, days);

  const events = await prisma.event.findMany({
    where: {
      buildingId,
      status: "ACTIVE",
      startTime: { lte: until },
      OR: [{ endTime: null }, { endTime: { gte: now } }],
    },
    orderBy: { startTime: "asc" },
  });

  const nowEvents = events.filter((event) => {
    const started = event.startTime <= now;
    const notEnded = event.endTime ? event.endTime >= now : true;
    return started && notEnded;
  });

  const upcomingEvents = events.filter((event) => event.startTime > now);

  return { nowEvents, upcomingEvents };
}

export type BuildingHeatData = {
  heatLevel: HeatLevel;
  eventCount: number;
  happeningNowCount: number;
  nextEventStartsAt: Date | null;
  cleCount: number;
};

export async function computeBuildingHeatLevels(): Promise<Map<string, BuildingHeatData>> {
  const now = new Date();
  const todayEnd = endOfDay(now);

  // Fetch all active events for today that are relevant
  const events = await prisma.event.findMany({
    where: {
      status: "ACTIVE",
      buildingId: { not: null },
      startTime: { lte: addDays(now, 3) },
      OR: [{ endTime: null }, { endTime: { gte: now } }],
    },
    select: {
      buildingId: true,
      startTime: true,
      endTime: true,
      isCLE: true,
    },
    orderBy: { startTime: "asc" },
  });

  // Group by building
  const byBuilding = new Map<string, typeof events>();
  for (const event of events) {
    if (!event.buildingId) continue;
    const arr = byBuilding.get(event.buildingId) ?? [];
    arr.push(event);
    byBuilding.set(event.buildingId, arr);
  }

  const result = new Map<string, BuildingHeatData>();

  for (const [buildingId, buildingEvents] of byBuilding) {
    let happeningNowCount = 0;
    let nextEventStartsAt: Date | null = null;
    let cleCount = 0;

    for (const event of buildingEvents) {
      if (event.isCLE) cleCount++;
      const started = event.startTime <= now;
      const notEnded = event.endTime ? event.endTime >= now : true;

      if (started && notEnded) {
        happeningNowCount++;
      } else if (event.startTime > now && !nextEventStartsAt) {
        nextEventStartsAt = event.startTime;
      }
    }

    // Compute heat level
    let heatLevel: HeatLevel = 0;
    if (happeningNowCount > 0) {
      heatLevel = 4;
    } else if (nextEventStartsAt) {
      const hoursUntil = (nextEventStartsAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      if (hoursUntil <= 3) {
        heatLevel = 3;
      } else if (hoursUntil <= 6) {
        heatLevel = 2;
      } else if (nextEventStartsAt <= todayEnd) {
        heatLevel = 1;
      }
    }

    result.set(buildingId, {
      heatLevel,
      eventCount: buildingEvents.length,
      happeningNowCount,
      nextEventStartsAt,
      cleCount,
    });
  }

  return result;
}
