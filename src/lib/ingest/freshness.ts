import { prisma } from "@/lib/prisma";

const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

/**
 * Returns true if the most recent successful ingest was more than 1 hour ago.
 */
export async function isDataStale(): Promise<boolean> {
  const latest = await prisma.eventSource.findFirst({
    where: { lastSuccessAt: { not: null } },
    orderBy: { lastSuccessAt: "desc" },
    select: { lastSuccessAt: true },
  });

  if (!latest?.lastSuccessAt) return true;

  return Date.now() - latest.lastSuccessAt.getTime() > STALE_THRESHOLD_MS;
}
