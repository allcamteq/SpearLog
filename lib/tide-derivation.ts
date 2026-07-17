import type { TideExtreme } from "@/lib/stormglass";
import { CURRENT_LEVELS, SEA_CONDITIONS, WIND_CONDITIONS } from "@/db/schema";

type Bracket = { before: TideExtreme; after: TideExtreme } | null;

/** Finds the extremes immediately before/after the reference time, falling back to the nearest available pair if the reference time falls outside the returned window. */
export function findBracketingExtremes(extremes: TideExtreme[], referenceTime: Date): Bracket {
  const sorted = [...extremes].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const refMs = referenceTime.getTime();

  let before: TideExtreme | null = null;
  let after: TideExtreme | null = null;

  for (const e of sorted) {
    const t = new Date(e.time).getTime();
    if (t <= refMs) before = e;
    if (t > refMs && !after) after = e;
  }

  if (!before && sorted.length >= 2) {
    before = sorted[0];
    after = sorted[1];
  } else if (!after && sorted.length >= 2) {
    before = sorted[sorted.length - 2];
    after = sorted[sorted.length - 1];
  }

  return before && after ? { before, after } : null;
}

/** Converts a "wall clock" date+time in a given IANA timezone into the true UTC instant it represents. */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string): Date {
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00Z`);
  const asIfLocal = new Date(naiveUtc.toLocaleString("en-US", { timeZone }));
  const asIfUtc = new Date(naiveUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = asIfUtc.getTime() - asIfLocal.getTime();
  return new Date(naiveUtc.getTime() + offsetMs);
}

export function formatTimeInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date(iso)
  );
}

export type DerivedTideFields = {
  highTideTime: string | null;
  lowTideTime: string | null;
  slackTideTime: string | null;
  tideRatio: number | null;
  tideType: "High to Low" | "Low to High" | null;
};

export function deriveTideFields(extremes: TideExtreme[], referenceTime: Date, timeZone: string): DerivedTideFields {
  // High/low tide times reflect the pair of extremes bracketing the reference
  // time — one always before it, one always after — since that's the pair
  // that actually describes the tide the session was fished around.
  const bracket = findBracketingExtremes(extremes, referenceTime);
  if (!bracket) {
    return {
      highTideTime: null,
      lowTideTime: null,
      slackTideTime: null,
      tideRatio: null,
      tideType: null,
    };
  }

  const { before, after } = bracket;
  const highExtreme = before.type === "high" ? before : after;
  const lowExtreme = before.type === "low" ? before : after;

  const tideType: DerivedTideFields["tideType"] =
    before.type === "high" && after.type === "low"
      ? "High to Low"
      : before.type === "low" && after.type === "high"
        ? "Low to High"
        : null;

  const slackMs = (new Date(before.time).getTime() + new Date(after.time).getTime()) / 2;

  return {
    highTideTime: formatTimeInZone(highExtreme.time, timeZone),
    lowTideTime: formatTimeInZone(lowExtreme.time, timeZone),
    slackTideTime: formatTimeInZone(new Date(slackMs).toISOString(), timeZone),
    tideRatio: Math.round(Math.abs(before.height - after.height) * 100) / 100,
    tideType,
  };
}

/** Buckets a current speed (knots) into the app's fixed CURRENT_LEVELS, matching the kt ranges documented in lib/constants.ts's CURRENT_LEVEL_LABELS. */
export function bucketCurrentLevel(kt: number): (typeof CURRENT_LEVELS)[number] {
  if (kt < 0.05) return "Zero";
  if (kt <= 0.5) return "Low";
  if (kt <= 1) return "Medium";
  return "High";
}

/** Buckets a wave height (meters) into the app's fixed SEA_CONDITIONS, matching the ranges documented in lib/constants.ts's SEA_CONDITION_LABELS. */
export function bucketSeaCondition(waveHeightM: number): (typeof SEA_CONDITIONS)[number] {
  if (waveHeightM < 0.5) return "Calm";
  if (waveHeightM <= 1.5) return "Rough";
  return "Very Rough";
}

/** Buckets a wind speed (knots) into the app's fixed WIND_CONDITIONS, matching the ranges documented in lib/constants.ts's WIND_CONDITION_LABELS. */
export function bucketWindCondition(windKt: number): (typeof WIND_CONDITIONS)[number] {
  if (windKt < 7) return "Calm";
  if (windKt <= 16) return "Moderate";
  return "Strong";
}

const COMPASS_POINTS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
] as const;

/** Converts a wind direction in degrees (0-360, meteorological "from" convention) into a 16-point compass label. */
export function compassDirection(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return COMPASS_POINTS[index];
}
