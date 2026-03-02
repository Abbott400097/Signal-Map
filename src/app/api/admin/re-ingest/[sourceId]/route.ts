import { NextRequest, NextResponse } from "next/server";
import { ingestSource } from "@/lib/ingest/service";

function verifyAdmin(request: NextRequest) {
  const token = request.headers.get("x-admin-token");
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return false;
  return token === expected;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sourceId: string }> }
) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sourceId } = await context.params;

  try {
    const result = await ingestSource(sourceId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
