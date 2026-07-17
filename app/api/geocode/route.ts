import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth-helpers";
import { geocodeLocation } from "@/lib/geocode";

export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const location = request.nextUrl.searchParams.get("location");
  const country = request.nextUrl.searchParams.get("country");

  if (!location) {
    return NextResponse.json({ error: "location is required" }, { status: 400 });
  }

  const result = await geocodeLocation(location, country);
  if (!result) {
    return NextResponse.json({ error: `Could not find a location for "${location}"` }, { status: 404 });
  }

  return NextResponse.json(result);
}
