import { find as findTimeZone } from "geo-tz/now";
import { geocodeLocation } from "@/lib/geocode";
import { getSavedLocationGeocode } from "@/db/queries/options";
import { listSessions } from "@/db/queries/sessions";
import { getTideExtremes, getMarineForecast, StormglassError, type TideExtreme } from "@/lib/stormglass";
import { zonedTimeToUtc, formatTimeInZone } from "@/lib/tide-derivation";
import { scoreTrip, type SlackWindow, type TripScore } from "@/lib/trip-score";

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

/** Summarises what the user's own logbook says about this location — the guide rates a personal log above every general rule on the page. */
async function summariseLog(userId: number, location: string): Promise<LogInsight> {
  const sessions = await listSessions(userId, { location });

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

  const [forecast, extremes] = await Promise.all([
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

  const scored = scoreTrip({
    hours: forecast,
    dayStart,
    dayEnd,
    timeZone,
    lat,
    month: Number(date.slice(5, 7)),
    slackWindows,
    springNeapRatio,
    workingDepthM,
    shoreFacingDeg,
    estuaryInfluence,
    forecastHorizonDays: Math.max(0, forecastHorizonDays),
  });

  const dayForecast = forecast.filter((h) => {
    const t = new Date(h.time).getTime();
    return t >= dayStart.getTime() && t < dayEnd.getTime();
  });
  const waterTemps = dayForecast.map((h) => h.waterTempC).filter((v): v is number => v != null);

  const log = await summariseLog(userId, location);

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
