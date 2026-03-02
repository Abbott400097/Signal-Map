import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.building.findMany({
    select: {
      id: true,
      name: true,
      lat: true,
      lng: true,
      campus: true,
      aliases: true
    },
    orderBy: { name: "asc" }
  });

  const buildings = rows.map((b) => ({
    ...b,
    aliases: JSON.parse(b.aliases) as string[]
  }));

  return NextResponse.json({ items: buildings });
}
