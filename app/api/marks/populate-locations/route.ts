import { NextResponse } from "next/server";
import { listMarksMissingLocation, listMarksMissingGps, setMarkLocation, setMarkGps } from "@/db/queries/marks";
import { addOption } from "@/db/queries/options";
import { reverseGeocode, geocodeLocation } from "@/lib/geocode";
import { getUserId } from "@/lib/auth-helpers";

// Space out lookups when there are several marks to resolve in one go — stays
// under both providers' free-tier caps (Nominatim ~1/second, LocationIQ 2/second).
const GEOCODE_DELAY_MS = 1100;

// Streams newline-delimited JSON progress events so the client can render a live
// progress bar — a full batch can take several seconds because of GEOCODE_DELAY_MS.
export async function POST() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [missingLocation, missingGps] = await Promise.all([
    listMarksMissingLocation(userId),
    listMarksMissingGps(userId),
  ]);
  const candidates = [
    ...missingLocation.map((mark) => ({ mark, direction: "location" as const })),
    ...missingGps.map((mark) => ({ mark, direction: "gps" as const })),
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const errors: string[] = [];
      let updated = 0;

      send({ type: "start", total: candidates.length });

      for (const [index, { mark, direction }] of candidates.entries()) {
        if (index > 0) await new Promise((resolve) => setTimeout(resolve, GEOCODE_DELAY_MS));

        if (direction === "location") {
          if (mark.lat != null && mark.lng != null) {
            const result = await reverseGeocode(mark.lat, mark.lng);
            if (result) {
              await setMarkLocation(userId, mark.id, result.location);
              await addOption(userId, "location", result.location);
              updated++;
            } else {
              errors.push(`${mark.name}: could not resolve a location for its coordinates`);
            }
          }
        } else if (mark.location) {
          const result = await geocodeLocation(mark.location);
          if (result) {
            await setMarkGps(userId, mark.id, result.lat, result.lng);
            updated++;
          } else {
            errors.push(`${mark.name}: could not resolve GPS coordinates for "${mark.location}"`);
          }
        }

        send({ type: "progress", completed: index + 1, total: candidates.length });
      }

      send({ type: "done", updated, total: candidates.length, errors });
      controller.close();
    },
  });

  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8" } });
}
