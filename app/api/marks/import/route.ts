import { NextRequest, NextResponse } from "next/server";
import { parseGpx } from "@/lib/gpx";
import { listMarks, createMark, updateMark } from "@/db/queries/marks";
import { markSchema } from "@/lib/validation/mark";
import { getUserId } from "@/lib/auth-helpers";
import { getUserById } from "@/db/queries/users";

function isEncryptedGps(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const payload = JSON.parse(value);
    return payload.version === 1 && typeof payload.iv === "string" && typeof payload.ciphertext === "string";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await getUserById(userId);
  if (user?.privateGpsEnabled) {
    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.waypoints)) {
      return NextResponse.json({ error: "Private GPS import requires encrypted waypoints." }, { status: 400 });
    }

    const existing = await listMarks(userId);
    const byName = new Map(existing.map((mark) => [mark.name.toLowerCase(), mark]));
    const errors: string[] = [];
    let imported = 0;

    for (const [index, waypoint] of body.waypoints.entries()) {
      const rowLabel = `Waypoint ${index + 1}`;
      if (!waypoint || typeof waypoint.name !== "string" || !isEncryptedGps(waypoint.gpsEncrypted)) {
        errors.push(`${rowLabel}: invalid encrypted mark data`);
        continue;
      }
      const match = byName.get(waypoint.name.toLowerCase());
      const parsed = markSchema.safeParse({
        name: waypoint.name,
        lat: null,
        lng: null,
        gpsEncrypted: waypoint.gpsEncrypted,
        location: match?.location ?? null,
        locationDetails: match?.locationDetails ?? null,
      });
      if (!parsed.success) {
        errors.push(`${rowLabel}: invalid mark data`);
        continue;
      }
      try {
        if (match) await updateMark(userId, match.id, parsed.data);
        else await createMark(userId, parsed.data);
        imported++;
      } catch {
        errors.push(`${rowLabel}: could not save`);
      }
    }

    return NextResponse.json({ imported, total: body.waypoints.length, errors });
  }

  const text = await request.text();
  if (!text.trim()) {
    return NextResponse.json({ error: "The uploaded file is empty" }, { status: 400 });
  }

  let waypoints;
  try {
    waypoints = parseGpx(text);
  } catch {
    return NextResponse.json({ error: "Could not parse that as a GPX file" }, { status: 400 });
  }

  if (waypoints.length === 0) {
    return NextResponse.json({ error: "No waypoints found in the file" }, { status: 400 });
  }

  const existing = await listMarks(userId);
  const byName = new Map(existing.map((m) => [m.name.toLowerCase(), m]));

  const errors: string[] = [];
  let imported = 0;

  for (const [index, wpt] of waypoints.entries()) {
    const rowLabel = `Waypoint ${index + 1} (${wpt.name})`;
    const match = byName.get(wpt.name.toLowerCase());

    const parsed = markSchema.safeParse({
      name: wpt.name,
      lat: wpt.lat,
      lng: wpt.lng,
      location: match?.location ?? null,
      locationDetails: match?.locationDetails ?? null,
    });
    if (!parsed.success) {
      errors.push(`${rowLabel}: invalid coordinates`);
      continue;
    }

    try {
      if (match) {
        await updateMark(userId, match.id, parsed.data);
      } else {
        await createMark(userId, parsed.data);
      }
      imported++;
    } catch {
      errors.push(`${rowLabel}: could not save`);
    }
  }

  return NextResponse.json({ imported, total: waypoints.length, errors });
}
