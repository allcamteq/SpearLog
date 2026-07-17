import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-helpers";
import { geocodeLocation } from "@/lib/geocode";
import { saveOptionLocation } from "@/db/queries/options";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const location = typeof body.location === "string" ? body.location : null;
  if (!location) {
    return NextResponse.json({ error: "location is required" }, { status: 400 });
  }

  const result = await geocodeLocation(location);
  if (!result) {
    return NextResponse.json({ error: `Could not find a location for "${location}"` }, { status: 404 });
  }

  await saveOptionLocation(userId, Number(id), {
    lat: result.lat,
    lng: result.lng,
    resolvedAddress: result.displayName,
  });

  return NextResponse.json(result);
}
