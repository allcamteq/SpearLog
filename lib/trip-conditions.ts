import { find as findTimeZone } from "geo-tz/now";
import { geocodeLocation } from "@/lib/geocode";
import { getSavedLocationGeocode } from "@/db/queries/options";
import { listSessions } from "@/db/queries/sessions";
import {
  getTideExtremes,
  getMarineForecast,
  StormglassError,
  type ForecastHour,
  type TideExtreme,
} from "@/lib/stormglass";
import {
  zonedTimeToUtc,
  formatTimeInZone,
  deriveTideFields,
  bucketCurrentLevel,
  bucketSeaCondition,
  bucketWindCondition,
} from "@/lib/tide-derivation";
import { scoreTrip, type SlackWindow, type TripScore } from "@/lib/trip-score";
import {
  matchLogEvidence,
  type ConditionSnapshot,
  type LoggedSession,
  type LogEvidence,
  type SessionMatch,
} from "@/lib/log-evidence";
import type { SessionWithCatches } from "@/db/queries/sessions";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export type TripPlanRequest = {
  location: string;
  country?: string | null;
  date: string; // "YYYY-MM-DD"
  workingDepthM: number;
  shoreFacingDeg: number | null;
  estuaryInfluence: boolean;
};

export type LogInsight = {
  sessionCount: number;
  ratedCount: number;
  averageRating: number | null;
  averageVisibilityM: number | null;
  best: { date: string | null; rating: number | null; tideType: string | null; current: string | null; visibility: number | null } | null;
  /** The prospective day described in logbook terms, so the comparison is inspectable. */
  snapshot: ConditionSnapshot | null;
  /** Sessions here dived in comparable conditions, closest first. Empty when none compare. */
  matches: SessionMatch[];
  comparedCount: number;
  /** Points the log moved the rating by. Zero when nothing comparable was found. */
  adjustment: number;
  /** 0-1, how far the matches are worth trusting. */
  strength: number;
  summary: string;
};

export type TripPlan = TripScore & {
  location: string;
  resolvedAddress: string | null;
  lat: number;
  lng: number;
  date: string;
  timeZone: string;
  workingDepthM: number;
  shoreFacingDeg: number | null;
  estuaryInfluence: boolean;
  /** Estimated slack windows for the day, with local times ready to display. */
  slack: { slackLocal: string; startLocal: string; endLocal: string; between: string }[];
  tideExtremes: { timeLocal: string; type: "high" | "low"; height: number }[];
  tideRangeM: number | null;
  springNeapRatio: number | null;
  waterTempC: number | null;
  /** Local "HH:MM" bounds of the recommended window, or null. */
  window: { startLocal: string; endLocal: string; score: number } | null;
  hours: { timeLocal: string; score: number; surgeM: number | null; windKt: number | null; currentKt: number | null }[];
  log: LogInsight;
};

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Pairs consecutive tide extremes and takes the midpoint as an estimate of the
 * stream's slack. This is deliberately the same derivation the logbook already
 * uses for recorded sessions — and it is an estimate: on a Channel-type coast
 * the real turn of the stream lags shore high water by one to three hours, so
 * the UI has to say so rather than imply precision it doesn't have.
 */
function deriveSlackWindows(extremes: TideExtreme[], fromMs: number, toMs: number, timeZone: string): SlackWindow[] {
  const sorted = [...extremes].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const windows: SlackWindow[] = [];

  for (let i = 0; i + 1 < sorted.length; i++) {
    const before = sorted[i];
    const after = sorted[i + 1];
    if (before.type === after.type) continue;

    const slackMs = (new Date(before.time).getTime() + new Date(after.time).getTime()) / 2;
    if (slackMs < fromMs || slackMs > toMs) continue;

    windows.push({
      slackISO: new Date(slackMs).toISOString(),
      startISO: new Date(slackMs - 60 * 60 * 1000).toISOString(),
      endISO: new Date(slackMs + 60 * 60 * 1000).toISOString(),
      between: `${before.type === "high" ? "HW" : "LW"} ${formatTimeInZone(before.time, timeZone)} → ${after.type === "high" ? "HW" : "LW"} ${formatTimeInZone(after.time, timeZone)}`,
    });
  }

  return windows;
}

/** Consecutive high-to-low ranges, used to place the day on the local spring/neap cycle. */
function rangesBetweenExtremes(extremes: TideExtreme[]): { timeMs: number; range: number }[] {
  const sorted = [...extremes].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  const out: { timeMs: number; range: number }[] = [];
  for (let i = 0; i + 1 < sorted.length; i++) {
    if (sorted[i].type === sorted[i + 1].type) continue;
    out.push({
      timeMs: new Date(sorted[i].time).getTime(),
      range: Math.abs(sorted[i].height - sorted[i + 1].height),
    });
  }
  return out;
}

/** Reduces a logged session to the fields lib/log-evidence.ts compares and scores. */
function toLoggedSession(session: SessionWithCatches): LoggedSession {
  return {
    id: session.id,
    date: session.date,
    tideType: session.tideType,
    tideRatio: session.tideRatio,
    current: session.current,
    currentSpeedKt: session.currentSpeedKt,
    seaCondition: session.seaCondition,
    windCondition: session.windCondition,
    windDirection: session.windDirection,
    month: session.date ? Number(session.date.slice(5, 7)) : null,
    rating: session.rating,
    fishAbundance: session.fishAbundance,
    catchCount: session.catches.reduce((sum, c) => sum + (c.quantity ?? 0), 0),
    visibility: session.visibility,
  };
}

/** Mean of a set of bearings. A plain average would call north-northwest and north-northeast "south". */
function circularMean(degrees: number[]): number | null {
  if (degrees.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const deg of degrees) {
    const rad = (deg * Math.PI) / 180;
    x += Math.cos(rad);
    y += Math.sin(rad);
  }
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return null;
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

/**
 * Describes the hours the diver would actually be in the water using the same
 * vocabulary a logged session carries, so the two can be compared field for
 * field. The tide fields come from `deriveTideFields` — the identical
 * derivation the logbook applies when recording a session — rather than a
 * second, subtly different one.
 */
function buildSnapshot(
  windowHours: ForecastHour[],
  extremes: TideExtreme[],
  referenceTime: Date,
  timeZone: string,
  month: number
): ConditionSnapshot {
  const waveHeight = mean(windowHours.map((h) => h.waveHeightM).filter((v): v is number => v != null));
  const windKt = mean(windowHours.map((h) => h.windSpeedKt).filter((v): v is number => v != null));
  const currentKt = mean(windowHours.map((h) => h.currentSpeedKt).filter((v): v is number => v != null));
  const windDir = circularMean(windowHours.map((h) => h.windDirectionDeg).filter((v): v is number => v != null));

  const tide = extremes.length > 0 ? deriveTideFields(extremes, referenceTime, timeZone) : null;

  return {
    tideType: tide?.tideType ?? null,
    tideRatio: tide?.tideRatio ?? null,
    current: currentKt != null ? bucketCurrentLevel(currentKt) : null,
    currentSpeedKt: currentKt != null ? Math.round(currentKt * 100) / 100 : null,
    seaCondition: waveHeight != null ? bucketSeaCondition(waveHeight) : null,
    windCondition: windKt != null ? bucketWindCondition(windKt) : null,
    windDirectionDeg: windDir != null ? Math.round(windDir) : null,
    month,
  };
}

/** Summarises what the user's own logbook says about this location — the guide rates a personal log above every general rule on the page. */
function summariseLog(
  sessions: SessionWithCatches[],
  snapshot: ConditionSnapshot | null,
  evidence: LogEvidence | null
): LogInsight {
  const ratings = sessions.map((s) => s.rating).filter((r): r is number => r != null);
  const visibilities = sessions.map((s) => s.visibility).filter((v): v is number => v != null);
  const best = sessions.filter((s) => s.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0];

  return {
    sessionCount: sessions.length,
    ratedCount: ratings.length,
    averageRating: ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null,
    averageVisibilityM: visibilities.length
      ? Math.round((visibilities.reduce((a, b) => a + b, 0) / visibilities.length) * 10) / 10
      : null,
    best: best
      ? {
          date: best.date,
          rating: best.rating,
          tideType: best.tideType,
          current: best.current,
          visibility: best.visibility,
        }
      : null,
    snapshot,
    matches: evidence?.matches ?? [],
    comparedCount: evidence?.comparedCount ?? 0,
    adjustment: evidence?.adjustment ?? 0,
    strength: evidence?.strength ?? 0,
    summary:
      evidence?.summary ??
      "No sessions logged here yet, so the rating is the general model only.",
  };
}

/**
 * Resolves a location, pulls the forecast and tides around the target date, and
 * scores the day. Costs two Stormglass requests: one hourly forecast covering
 * the day plus the three days of swell history before it, and one set of tide
 * extremes covering the surrounding fortnight so the day can be placed on the
 * local spring/neap cycle.
 */
export async function planTrip(userId: number, request: TripPlanRequest): Promise<TripPlan> {
  const { location, country, date, workingDepthM, shoreFacingDeg, estuaryInfluence } = request;

  // Prefer a geocode verified via "Check location" in Maintenance over a fresh
  // lookup, which can mismatch on ambiguous place names. A saved one carries
  // coordinates only; a fresh lookup also names what it matched.
  const saved = await getSavedLocationGeocode(userId, location);
  const fresh = saved ? null : await geocodeLocation(location, country ?? undefined);
  const coords = saved ?? fresh;
  if (!coords) {
    throw new Error(`Could not find a location for "${location}"`);
  }
  const { lat, lng } = coords;
  const resolvedAddress = fresh?.displayName ?? null;

  const timeZone = findTimeZone(lat, lng)[0] ?? "UTC";
  const dayStart = zonedTimeToUtc(date, "00:00", timeZone);
  const dayEnd = zonedTimeToUtc(addDays(date, 1), "00:00", timeZone);

  const [forecast, extremes, loggedSessions] = await Promise.all([
    // Three days of history ahead of the day itself: the guide's 24-72 h
    // recovery window after a blow is what decides whether the sand has settled.
    getMarineForecast(lat, lng, new Date(dayStart.getTime() - 3 * DAY_MS).toISOString(), dayEnd.toISOString()),
    getTideExtremes(
      lat,
      lng,
      zonedTimeToUtc(addDays(date, -7), "00:00", timeZone).toISOString(),
      zonedTimeToUtc(addDays(date, 7), "00:00", timeZone).toISOString()
    ).catch((error) => {
      // A site with no tide station nearby should still get a rating from swell
      // and wind, with the stream factor simply marked unavailable.
      if (error instanceof StormglassError && error.code === "no_data") return [] as TideExtreme[];
      throw error;
    }),
    listSessions(userId, { location }),
  ]);

  const slackWindows = deriveSlackWindows(extremes, dayStart.getTime(), dayEnd.getTime(), timeZone);

  const ranges = rangesBetweenExtremes(extremes);
  const dayRanges = ranges.filter((r) => r.timeMs >= dayStart.getTime() && r.timeMs < dayEnd.getTime());
  const fortnightMax = ranges.length ? Math.max(...ranges.map((r) => r.range)) : 0;
  const dayMaxRange = dayRanges.length ? Math.max(...dayRanges.map((r) => r.range)) : null;
  const springNeapRatio = dayMaxRange != null && fortnightMax > 0 ? dayMaxRange / fortnightMax : null;

  const todayUtcMidnight = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  const targetUtcMidnight = new Date(`${date}T00:00:00Z`).getTime();
  const forecastHorizonDays = Math.round((targetUtcMidnight - todayUtcMidnight) / DAY_MS);

  const month = Number(date.slice(5, 7));
  const scoreInput = {
    hours: forecast,
    dayStart,
    dayEnd,
    timeZone,
    lat,
    month,
    slackWindows,
    springNeapRatio,
    workingDepthM,
    shoreFacingDeg,
    estuaryInfluence,
    forecastHorizonDays: Math.max(0, forecastHorizonDays),
  };

  // Scored twice, on purpose. The log is compared against the hours the diver
  // would actually be in the water, and which hours those are is an output of
  // the first pass — so the first pass finds the window, and the second applies
  // what the log says about conditions in it. Both passes are pure arithmetic
  // over roughly a hundred hourly samples; no extra requests are made.
  const forecastOnly = scoreTrip(scoreInput);

  const dayForecast = forecast.filter((h) => {
    const t = new Date(h.time).getTime();
    return t >= dayStart.getTime() && t < dayEnd.getTime();
  });
  const waterTemps = dayForecast.map((h) => h.waterTempC).filter((v): v is number => v != null);

  const windowStartMs = forecastOnly.bestWindow
    ? new Date(forecastOnly.bestWindow.startISO).getTime()
    : dayStart.getTime();
  const windowEndMs = forecastOnly.bestWindow
    ? new Date(forecastOnly.bestWindow.endISO).getTime()
    : dayEnd.getTime();
  const windowHours = dayForecast.filter((h) => {
    const t = new Date(h.time).getTime();
    return t >= windowStartMs && t < windowEndMs;
  });

  const snapshot = buildSnapshot(
    windowHours.length > 0 ? windowHours : dayForecast,
    extremes,
    new Date((windowStartMs + windowEndMs) / 2),
    timeZone,
    month
  );

  const evidence = matchLogEvidence(snapshot, loggedSessions.map(toLoggedSession));
  const scored = evidence.matches.length > 0 ? scoreTrip({ ...scoreInput, logEvidence: evidence }) : forecastOnly;

  const log = summariseLog(loggedSessions, snapshot, evidence);

  return {
    ...scored,
    location,
    resolvedAddress,
    lat,
    lng,
    date,
    timeZone,
    workingDepthM,
    shoreFacingDeg,
    estuaryInfluence,
    slack: slackWindows.map((w) => ({
      slackLocal: formatTimeInZone(w.slackISO, timeZone),
      startLocal: formatTimeInZone(w.startISO, timeZone),
      endLocal: formatTimeInZone(w.endISO, timeZone),
      between: w.between,
    })),
    tideExtremes: extremes
      .filter((e) => {
        const t = new Date(e.time).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      })
      .map((e) => ({
        timeLocal: formatTimeInZone(e.time, timeZone),
        type: e.type,
        height: Math.round(e.height * 100) / 100,
      })),
    tideRangeM: dayMaxRange != null ? Math.round(dayMaxRange * 100) / 100 : null,
    springNeapRatio: springNeapRatio != null ? Math.round(springNeapRatio * 100) / 100 : null,
    waterTempC: waterTemps.length
      ? Math.round((waterTemps.reduce((a, b) => a + b, 0) / waterTemps.length) * 10) / 10
      : null,
    window: scored.bestWindow
      ? {
          startLocal: formatTimeInZone(scored.bestWindow.startISO, timeZone),
          endLocal: formatTimeInZone(scored.bestWindow.endISO, timeZone),
          score: scored.bestWindow.score,
        }
      : null,
    hours: scored.hourScores
      .filter((h) => h.localHour >= 5 && h.localHour <= 21)
      .map((h) => ({
        timeLocal: formatTimeInZone(h.time, timeZone),
        score: h.score,
        surgeM: h.surgeM,
        windKt: h.windKt,
        currentKt: h.currentKt,
      })),
    log,
  };
}

export { StormglassError };
