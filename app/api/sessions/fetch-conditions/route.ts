import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth-helpers";
import { fetchSessionConditions, StormglassError } from "@/lib/fetch-session-conditions";

const bodySchema = z.object({
  location: z.string().min(1),
  country: z.string().optional().nullable(),
  date: z.string().min(1),
  startTime: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Location and date are required" }, { status: 400 });
  }

  try {
    const conditions = await fetchSessionConditions(userId, parsed.data);
    return NextResponse.json(conditions);
  } catch (error) {
    if (error instanceof StormglassError) {
      const status =
        error.code === "missing_key" || error.code === "unauthorized"
          ? 500
          : error.code === "quota_exceeded"
            ? 429
            : 502;
      return NextResponse.json({ error: error.message }, { status });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not fetch tide/current data" }, { status: 502 });
  }
}
