import { addDays } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  buildingId: z.string().cuid().optional(),
  category: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(params);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const { buildingId, category, from, to } = parsed.data;
  const now = new Date();
  const fromDate = from ?? now;
  const toDate = to ?? addDays(now, 3);

  // Include both:
  // 1. Events starting within the window (upcoming)
  // 2. Events that started before `from` but haven't ended yet (ongoing)
  const events = await prisma.event.findMany({
    where: {
      status: "ACTIVE",
      buildingId,
      category,
      OR: [
        // Upcoming: starts within window
        { startTime: { gte: fromDate, lte: toDate } },
        // Ongoing: started before window but still running
        { startTime: { lt: fromDate }, endTime: { gte: fromDate } },
      ],
    },
    orderBy: { startTime: "asc" },
  });

  return NextResponse.json({
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
    items: events
  });
}
