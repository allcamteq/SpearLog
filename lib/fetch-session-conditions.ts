import { find as findTimeZone } from "geo-tz/now";
import { geocodeLocation } from "@/lib/geocode";
import { getSavedLocationGeocode } from "@/db/queries/options";
import { getTideExtremes, getMarineConditions, StormglassError } from "@/lib/stormglass";
import { deriveTideFields, bucketCurrentLevel, bucketSeaCondition, bucketWindCondition, zonedTimeToUtc } from "@/lib/tide-derivation";

function nextDateString(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type SessionConditions = {
  gpsPoint: string;
  highTideTime: string | null;
  lowTideTime: string | null;
  slackTideTime: string | null;
  tideRatio: number | null;
  tideType: "High to Low" | "Low to High" | null;
  current: "Zero" | "Low" | "Medium" | "High" | null;
  currentSpeedKt: number | null;
  seaCondition: "Calm" | "Rough" | "Very Rough" | null;
  windCondition: "Calm" | "Moderate" | "Strong" | null;
  windDirection: number | null;
  pressure: number | null;
};

/** Shared by the per-session "Fetch tide & current data" button and the bulk Logbook fetch — resolves a location to coordinates, then pulls tide extremes and marine conditions from Stormglass for the given date/time. Throws StormglassError or a plain Error (e.g. unresolvable location) on failure. */
export async function fetchSessionConditions(
  userId: number,
  params: { location: string; country?: string | null; date: string; startTime?: string | null }
): Promise<SessionConditions> {
  const { location, country, date, startTime } = params;

  // Prefer a verified geocode saved via "Check location" in Maintenance — it's
  // more trustworthy than a fresh Nominatim lookup, which can mismatch on
  // ambiguous place names.
  const saved = await getSavedLocationGeocode(userId, location);
  const geocoded = saved ?? (await geocodeLocation(location, country ?? undefined));
  if (!geocoded) {
    throw new Error(`Could not find a location for "${location}"`);
  }
  const { lat, lng } = geocoded;

  const timeZone = findTimeZone(lat, lng)[0] ?? "UTC";
  const referenceTime = zonedTimeToUtc(date, startTime || "12:00", timeZone);
  const dayStart = zonedTimeToUtc(date, "00:00", timeZone);
  // Fetch two days forward (not just the rest of the requested day) so the
  // "next" high/low after a late start time is still within the window.
  const dayEnd = zonedTimeToUtc(nextDateString(nextDateString(date)), "00:00", timeZone);

  const extremes = await getTideExtremes(lat, lng, dayStart.toISOString(), dayEnd.toISOString());
  const tideFields = deriveTideFields(extremes, referenceTime, timeZone);

  const { currentSpeedKt, waveHeightM, windSpeedKt, windDirectionDeg, pressureHpa } = await getMarineConditions(
    lat,
    lng,
    referenceTime.toISOString()
  );
  const current = currentSpeedKt != null ? bucketCurrentLevel(currentSpeedKt) : null;
  const seaCondition = waveHeightM != null ? bucketSeaCondition(waveHeightM) : null;
  const windCondition = windSpeedKt != null ? bucketWindCondition(windSpeedKt) : null;

  return {
    gpsPoint: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    ...tideFields,
    current,
    currentSpeedKt: currentSpeedKt != null ? Math.round(currentSpeedKt * 100) / 100 : null,
    seaCondition,
    windCondition,
    windDirection: windDirectionDeg != null ? Math.round(windDirectionDeg) : null,
    pressure: pressureHpa != null ? Math.round(pressureHpa * 10) / 10 : null,
  };
}

export { StormglassError };
