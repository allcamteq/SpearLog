import { NextRequest, NextResponse } from "next/server";
import { getMarkById, setMarkLocation, setMarkGps } from "@/db/queries/marks";
import { addOption } from "@/db/queries/options";
import { reverseGeocode, geocodeLocation } from "@/lib/geocode";
import { getUserId } from "@/lib/auth-helpers";

type RouteParams = { params: Promise<{ id: string }> };

// Fills in whichever of location/GPS is missing on a single mark — reverse-geocodes
// from GPS when location is missing, or forward-geocodes from location when GPS is missing.
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const mark = await getMarkById(userId, Number(id));
  if (!mark) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hasGps = mark.lat != null && mark.lng != null;
  const hasLocation = !!mark.location;

  if (hasGps && !hasLocation) {
    const result = await reverseGeocode(mark.lat!, mark.lng!);
    if (!result) return NextResponse.json({ error: "Could not resolve a location for its coordinates." }, { status: 422 });
    await setMarkLocation(userId, mark.id, result.location);
    await addOption(userId, "location", result.location);
    return NextResponse.json({ location: result.location });
  }

  if (hasLocation && !hasGps) {
    const result = await geocodeLocation(mark.location!);
    if (!result) return NextResponse.json({ error: `Could not resolve GPS coordinates for "${mark.location}".` }, { status: 422 });
    await setMarkGps(userId, mark.id, result.lat, result.lng);
    return NextResponse.json({ lat: result.lat, lng: result.lng });
  }

  return NextResponse.json(
    { error: hasGps ? "This mark already has both a location and GPS." : "Add a location or GPS first." },
    { status: 422 }
  );
}
