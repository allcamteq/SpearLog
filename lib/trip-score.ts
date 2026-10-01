/**
 * Scores a prospective dive/spearfishing trip out of 10 from forecast data.
 *
 * The model implements "Reading the Channel" — a breath-hold spearfishing
 * conditions guide for the English Channel coast. Two ideas drive it:
 *
 *  1. Visibility and a safe surface are the real constraints, and nearly every
 *     other variable is a proxy for one of those two. So swell-driven bottom
 *     surge and wind dominate the weights, and they can veto an otherwise
 *     perfect day ("a perfect tide on the third day of a southwesterly is
 *     still a wasted drive").
 *  2. Swell *period* decides bottom surge, not swell height. A 1 m 14 s
 *     groundswell moves three times more water at 10 m than a taller 5 s
 *     wind sea does.
 *
 * Each factor carries the guide's own confidence rating (High where there's a
 * clear physical mechanism, Medium where the numbers are approximations or the
 * site dominates), and factors the guide rates Low — moon phase, barometric
 * pressure — are deliberately excluded rather than given a small weight.
 *
 * Everything here is pure: no I/O, no clock reads. lib/trip-conditions.ts
 * gathers the data and calls in.
 *
 * Type-only import: this module is reachable from the client bundle, and
 * lib/log-evidence.ts pulls in the Drizzle schema. The evidence is computed
 * server-side and handed in as plain data.
 */

import type { LogEvidence } from "@/lib/log-evidence";

export type Confidence = "High" | "Medium" | "Low";

/** One hour of forecast, already unit-converted. Any field may be missing. */
export type HourSample = {
  time: string; // ISO, UTC
  swellHeightM: number | null;
  swellPeriodS: number | null;
  swellDirectionDeg: number | null; // "from", meteorological convention
  waveHeightM: number | null;
  wavePeriodS: number | null;
  windSpeedKt: number | null;
  windDirectionDeg: number | null; // "from"
  gustKt: number | null;
  currentSpeedKt: number | null;
  currentDirectionDeg: number | null; // "towards", oceanographic convention
  waterTempC: number | null;
  airTempC: number | null;
  precipitationMm: number | null;
  cloudCoverPct: number | null;
};

export type SlackWindow = {
  /** Midpoint between two tide extremes — an *estimate* of the stream's slack. */
  slackISO: string;
  startISO: string;
  endISO: string;
  /** The extremes it sits between, for display. */
  between: string;
};

export type ScoreInput = {
  /** Local-midnight-to-midnight hours for the target date, plus the 72 h before it. */
  hours: HourSample[];
  /** UTC instant of local midnight on the target date. */
  dayStart: Date;
  /** UTC instant of local midnight the following day. */
  dayEnd: Date;
  timeZone: string;
  /** Latitude, used only to flip the seasonal model for the southern hemisphere. */
  lat: number;
  /** Month of the target date, 1-12. */
  month: number;
  /** Derived from tide extremes; may be empty if no tide station is near. */
  slackWindows: SlackWindow[];
  /** This day's largest high-to-low range, as a fraction of the largest in the surrounding fortnight. 0-1, or null. */
  springNeapRatio: number | null;
  /** Depth the diver actually works at. Bottom surge is computed here. */
  workingDepthM: number;
  /** Direction the shore faces out to sea, in degrees. Null when the user hasn't set it. */
  shoreFacingDeg: number | null;
  /** Whether the site sits downstream of a river or harbour, which makes rainfall matter. */
  estuaryInfluence: boolean;
  /** Days between today and the target date, for forecast-horizon confidence. */
  forecastHorizonDays: number;
  /**
   * What the user's own log at this location says about conditions like these.
   * Null when there is no logbook to read — the rating is then the general
   * model alone.
   */
  logEvidence?: LogEvidence | null;
};

export type FactorKey =
  | "surge"
  | "recovery"
  | "wind"
  | "windOverTide"
  | "stream"
  | "light"
  | "season"
  | "rain";

export type Factor = {
  key: FactorKey;
  label: string;
  /** 0-10, or null when the data needed wasn't available. */
  score: number | null;
  /** Share of the final rating, after dropping unavailable factors. 0-1. */
  weight: number;
  /** One sentence on what the number actually says. */
  detail: string;
  /** The guide's confidence in this mechanism, not in the forecast. */
  confidence: Confidence;
};

export type HourScore = {
  time: string;
  localHour: number;
  surgeM: number | null;
  windKt: number | null;
  currentKt: number | null;
  /** Blend of the time-varying factors only, 0-10. Used to pick the window. */
  score: number;
};

export type Recommendation = {
  title: string;
  body: string;
  confidence: Confidence;
};

export type TripScore = {
  score: number; // 0-10, one decimal
  verdict: "Go" | "Worth it" | "Marginal" | "Stay home";
  confidence: Confidence;
  confidenceReason: string;
  bestWindow: { startISO: string; endISO: string; score: number } | null;
  /** Ceilings that capped the rating, e.g. unworkable swell. Empty when none bit. */
  caps: string[];
  /**
   * How the user's own log at this location moved the rating. Null when there
   * was no comparable session to learn from, so the absence reads as "nothing
   * to compare" rather than "no effect".
   */
  logAdjustment: {
    /** Points added to or taken off the forecast rating, after clamping. */
    points: number;
    /** Rating before the log was applied, for showing the working. */
    forecastOnly: number;
    matchCount: number;
    summary: string;
  } | null;
  factors: Factor[];
  hourScores: HourScore[];
  recommendations: Recommendation[];
};

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
] as const;

export function compass(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

/**
 * Orbital surge at depth from a wave's height and period, in metres.
 *
 * Deep-water wavelength L = 1.56 T², and orbital motion decays with depth as
 * e^(−2πd/L). A 1.2 m 5 s wind sea leaves ~24 cm at 10 m; a 1.0 m 14 s
 * groundswell leaves ~80 cm. This single function is why the model reads
 * period before height.
 */
export function bottomSurgeM(heightM: number, periodS: number, depthM: number): number {
  const wavelength = 1.56 * periodS * periodS;
  return heightM * Math.exp((-2 * Math.PI * depthM) / wavelength);
}

/** Piecewise-linear lookup over ascending [x, y] breakpoints, clamped at both ends. */
function ramp(x: number, points: [number, number][]): number {
  if (x <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (x >= last[0]) return last[1];

  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return last[1];
}

const clamp10 = (n: number) => Math.max(0, Math.min(10, n));

/** Smallest angle between two bearings, 0-180. */
function angleDelta(a: number, b: number): number {
  const d = Math.abs((((a - b) % 360) + 360) % 360);
  return d > 180 ? 360 - d : d;
}

/** The surge-producing wave for an hour: the swell if reported, else the combined sea. */
function surgeFor(hour: HourSample, depthM: number): { surgeM: number; heightM: number; periodS: number } | null {
  const height = hour.swellHeightM ?? hour.waveHeightM;
  const period = hour.swellPeriodS ?? hour.wavePeriodS;
  if (height == null || period == null || period <= 0) return null;
  return { surgeM: bottomSurgeM(height, period, depthM), heightM: height, periodS: period };
}

/**
 * Bottom surge → score. Breakpoints are anchored to the guide's two worked
 * examples: ~24 cm ("a nuisance at the surface") scores well, ~80 cm
 * ("sand up, viz gone") scores near zero.
 */
function surgeScore(surgeM: number): number {
  return ramp(surgeM, [
    [0.1, 10],
    [0.15, 9],
    [0.25, 7.5],
    [0.4, 5],
    [0.6, 2.5],
    [0.8, 1],
    [1.0, 0],
  ]);
}

/**
 * Wind → score. Direction first, strength second: the guide rates a 10-15 kt
 * offshore breeze *better* than a flat calm (it grooms the surface and holds
 * the water clean), and the same strength onshore as a wasted day. Without a
 * shore aspect we can only fall back to strength, which is why setting the
 * aspect moves the whole result's confidence.
 */
function windScore(windKt: number, windFromDeg: number | null, shoreFacingDeg: number | null): number {
  // +1 fully offshore (blowing from the land out to sea), −1 fully onshore.
  const offshoreness =
    windFromDeg != null && shoreFacingDeg != null
      ? -Math.cos(((windFromDeg - shoreFacingDeg) * Math.PI) / 180)
      : null;

  // The component of the wind that actually piles water onto the site. With no
  // aspect, assume a middling exposure rather than pretending either extreme.
  const onshoreKt = offshoreness != null ? (windKt * (1 - offshoreness)) / 2 : windKt * 0.6;

  let score = ramp(onshoreKt, [
    [3, 10],
    [6, 8],
    [10, 6],
    [12, 5], // the guide's workable ceiling: "wind under about 12 kn from a favourable quarter"
    [16, 3],
    [22, 1],
    [28, 0],
  ]);

  // Offshore wind in the 8-16 kt band is the one the guide actively wants.
  if (offshoreness != null && offshoreness >= 0.5 && windKt >= 8 && windKt <= 16) score += 0.8;

  // However favourable the quarter, a strong wind is a surface-safety problem.
  if (windKt > 25) score = Math.min(score, 2);

  return clamp10(score);
}

/**
 * Wind against stream → score. An opposing current compresses the wavelength
 * while the height grows, so a modest breeze that would raise nothing on slack
 * water tips into breaking chop against two knots. Wind direction is "from"
 * and current direction is "towards", so they oppose when the two bearings
 * *match*.
 */
function windOverTideScore(windKt: number, windFromDeg: number, currentKt: number, currentTowardsDeg: number): number {
  const opposition = Math.cos(((windFromDeg - currentTowardsDeg) * Math.PI) / 180);
  const severity =
    Math.max(0, opposition) * Math.min(windKt / 20, 1) * Math.min(currentKt / 1.5, 1);
  return clamp10(10 - 8 * severity);
}

/** Current speed → score, on the same knot bands the logbook already uses for CURRENT_LEVELS. */
function currentScore(currentKt: number): number {
  return ramp(currentKt, [
    [0.1, 10],
    [0.3, 8.5],
    [0.5, 7],
    [0.8, 5],
    [1.2, 2.5],
    [1.6, 1],
    [2.0, 0],
  ]);
}

/** How close an instant sits to the nearest estimated slack. */
function slackProximityScore(timeMs: number, windows: SlackWindow[]): number | null {
  if (windows.length === 0) return null;
  const minutes = Math.min(
    ...windows.map((w) => Math.abs(timeMs - new Date(w.slackISO).getTime()) / 60000)
  );
  return ramp(minutes, [
    [0, 10],
    [60, 8],
    [90, 6],
    [120, 4],
    [180, 2],
    [240, 1],
  ]);
}

/** Light → score. The guide's window is 10:00-16:00 local, when the sun reaches into gullies and under ledges. */
function lightScore(localHour: number, cloudPct: number | null): number {
  const base = ramp(localHour, [
    [6, 0],
    [7, 2],
    [8, 4.5],
    [9, 7],
    [10, 10],
    [16, 10],
    [17, 7],
    [18, 4.5],
    [19, 2],
    [20, 0],
  ]);
  // Overcast costs some of that, but it can't turn midday into dusk.
  return clamp10(base - 1.2 * ((cloudPct ?? 0) / 100));
}

// The guide's season shape for the Channel coast: a spring plankton bloom that
// trades the year's best weather for its worst visibility, then a September-
// October peak, then the gales. Dec-Mar sit outside its stated May-Nov season.
const SEASON_BY_MONTH: Record<number, { score: number; note: string }> = {
  1: { score: 2.5, note: "outside the guide's May-November season — cold, short days and gale-prone" },
  2: { score: 2.5, note: "outside the guide's May-November season — cold, short days and gale-prone" },
  3: { score: 3, note: "outside the guide's May-November season; water is at its coldest and the bloom is starting" },
  4: { score: 4, note: "the spring bloom is building — good weather, green water" },
  5: { score: 4.5, note: "peak plankton bloom: the best weather of the year and some of the worst visibility" },
  6: { score: 6, note: "bloom clearing, visibility mixed and improving" },
  7: { score: 7.5, note: "good visibility, though a thermocline around 8-12 m can hide dirtier water below" },
  8: { score: 7.5, note: "good visibility and warm water; weather risk starting to rise" },
  9: { score: 10, note: "the peak — warmest water of the year, best clarity, fish at their heaviest" },
  10: { score: 9.5, note: "still peak for clarity and fish size, but gale risk is high" },
  11: { score: 6.5, note: "big fish, fewer of them; visibility mixed and weather risk high" },
  12: { score: 3, note: "outside the guide's May-November season — cold, short days and gale-prone" },
};

function seasonFor(month: number, lat: number): { score: number; note: string } {
  // The model is calibrated to the temperate North Atlantic. South of the
  // equator the same shape applies half a year out of phase.
  const effective = lat < 0 ? ((month + 5) % 12) + 1 : month;
  return SEASON_BY_MONTH[effective] ?? { score: 5, note: "" };
}

/** Rainfall → score, for sites that sit downstream of a river or harbour. */
function rainScore(precip48hMm: number): number {
  return ramp(precip48hMm, [
    [2, 10],
    [5, 8],
    [10, 6],
    [20, 3.5],
    [35, 1.5],
    [50, 0],
  ]);
}

function mean(values: number[]): number | null {
  const usable = values.filter((v) => Number.isFinite(v));
  return usable.length ? usable.reduce((a, b) => a + b, 0) / usable.length : null;
}

/** Weights before any unavailable factor is dropped. They are renormalised over whatever survives. */
const BASE_WEIGHTS: Record<FactorKey, number> = {
  surge: 0.28,
  recovery: 0.12,
  wind: 0.18,
  windOverTide: 0.1,
  stream: 0.14,
  light: 0.08,
  season: 0.1,
  rain: 0.06, // only counted when the site has estuary influence
};

const FACTOR_CONFIDENCE: Record<FactorKey, Confidence> = {
  surge: "High",
  recovery: "Medium",
  wind: "High",
  windOverTide: "High",
  stream: "High",
  light: "High",
  season: "Medium",
  rain: "Medium",
};

/** Time-varying factors, used to score each hour and pick the dive window. */
const WINDOW_KEYS = ["surge", "wind", "windOverTide", "stream", "light"] as const;

export function scoreTrip(input: ScoreInput): TripScore {
  const {
    hours,
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
    forecastHorizonDays,
    logEvidence,
  } = input;

  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayEnd.getTime();
  const dayHours = hours.filter((h) => {
    const t = new Date(h.time).getTime();
    return t >= dayStartMs && t < dayEndMs;
  });
  const priorHours = hours.filter((h) => new Date(h.time).getTime() < dayStartMs);

  // Spring tides narrow the slack to minutes; neaps move less sediment and give
  // a longer, safer window. The ratio is relative to the local fortnight, since
  // absolute range means nothing across ports (Dorset runs 1-2 m on springs,
  // Newhaven 6 m).
  const springNeapMultiplier =
    springNeapRatio == null ? 1 : ramp(springNeapRatio, [[0.55, 1], [0.85, 0.85]]);

  const localHourOf = (iso: string): number => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
    const [h, m] = parts.split(":").map(Number);
    return h + m / 60;
  };

  // ---- per-hour scoring, which drives the window pick -------------------
  const hourScores: HourScore[] = dayHours.map((hour) => {
    const t = new Date(hour.time).getTime();
    const localHour = localHourOf(hour.time);
    const surge = surgeFor(hour, workingDepthM);

    const parts: Partial<Record<(typeof WINDOW_KEYS)[number], number>> = {};
    if (surge) parts.surge = surgeScore(surge.surgeM);
    if (hour.windSpeedKt != null) parts.wind = windScore(hour.windSpeedKt, hour.windDirectionDeg, shoreFacingDeg);
    if (
      hour.windSpeedKt != null &&
      hour.windDirectionDeg != null &&
      hour.currentSpeedKt != null &&
      hour.currentDirectionDeg != null
    ) {
      parts.windOverTide = windOverTideScore(
        hour.windSpeedKt,
        hour.windDirectionDeg,
        hour.currentSpeedKt,
        hour.currentDirectionDeg
      );
    }

    // Stream leans on the modelled current where it exists, with slack timing
    // as the cross-check — the guide's point being that the stream, not the
    // tide table, decides whether you can dive.
    const proximity = slackProximityScore(t, slackWindows);
    const speed = hour.currentSpeedKt != null ? currentScore(hour.currentSpeedKt) : null;
    const streamBase =
      speed != null && proximity != null
        ? 0.65 * speed + 0.35 * proximity
        : (speed ?? proximity);
    if (streamBase != null) parts.stream = clamp10(streamBase * springNeapMultiplier);

    parts.light = lightScore(localHour, hour.cloudCoverPct);

    let weighted = 0;
    let weightSum = 0;
    for (const key of WINDOW_KEYS) {
      const value = parts[key];
      if (value == null) continue;
      weighted += value * BASE_WEIGHTS[key];
      weightSum += BASE_WEIGHTS[key];
    }

    // Light is only 8% of the blend, which is the right weight for choosing
    // between two daylight hours but far too little to express that you cannot
    // dive in the dark at all. So it also caps the hour: at last light the best
    // possible sea is still a 3.
    const base = weightSum > 0 ? weighted / weightSum : 0;
    const score = Math.min(base, 3 + 0.7 * parts.light);

    return {
      time: hour.time,
      localHour,
      surgeM: surge ? Math.round(surge.surgeM * 100) / 100 : null,
      windKt: hour.windSpeedKt != null ? Math.round(hour.windSpeedKt * 10) / 10 : null,
      currentKt: hour.currentSpeedKt != null ? Math.round(hour.currentSpeedKt * 100) / 100 : null,
      score: Math.round(score * 10) / 10,
    };
  });

  // ---- best two-hour window ---------------------------------------------
  const daylight = hourScores.filter((h) => h.localHour >= 6 && h.localHour <= 20);
  let bestWindow: TripScore["bestWindow"] = null;
  let windowHours: HourScore[] = [];

  for (let i = 0; i + 1 < daylight.length; i++) {
    const pair = [daylight[i], daylight[i + 1]];
    const avg = (pair[0].score + pair[1].score) / 2;
    if (!bestWindow || avg > bestWindow.score) {
      const end = new Date(new Date(pair[1].time).getTime() + 60 * 60 * 1000);
      bestWindow = { startISO: pair[0].time, endISO: end.toISOString(), score: Math.round(avg * 10) / 10 };
      windowHours = pair;
    }
  }
  // A day with only one usable hour of data still deserves an answer.
  if (!bestWindow && daylight.length === 1) {
    const only = daylight[0];
    bestWindow = {
      startISO: only.time,
      endISO: new Date(new Date(only.time).getTime() + 60 * 60 * 1000).toISOString(),
      score: only.score,
    };
    windowHours = [only];
  }

  const windowSamples = dayHours.filter((h) => windowHours.some((w) => w.time === h.time));
  const sampled = windowSamples.length > 0 ? windowSamples : dayHours;

  // ---- day-level factors -------------------------------------------------
  const factors: Factor[] = [];
  const add = (key: FactorKey, score: number | null, detail: string) => {
    factors.push({
      key,
      label: FACTOR_LABELS[key],
      score: score == null ? null : Math.round(score * 10) / 10,
      weight: 0, // filled in after renormalisation
      detail,
      confidence: FACTOR_CONFIDENCE[key],
    });
  };

  // Surge, at the window.
  const windowSurges = sampled.map((h) => surgeFor(h, workingDepthM)).filter((s): s is NonNullable<typeof s> => s != null);
  if (windowSurges.length > 0) {
    const avgSurge = mean(windowSurges.map((s) => s.surgeM))!;
    const avgHeight = mean(windowSurges.map((s) => s.heightM))!;
    const avgPeriod = mean(windowSurges.map((s) => s.periodS))!;
    const groundswell = avgPeriod >= 11;
    add(
      "surge",
      surgeScore(avgSurge),
      `${avgHeight.toFixed(1)} m at ${avgPeriod.toFixed(0)} s moves about ${Math.round(avgSurge * 100)} cm of water at ${workingDepthM} m.` +
        (groundswell
          ? " At 11 s or more this is Atlantic groundswell, which reaches the bottom even when it looks small."
          : " Short-period wind sea — mostly a surface problem you can hide from behind a headland.")
    );
  } else {
    add("surge", null, "No swell height or period in the forecast for this point.");
  }

  // Recovery from a recent blow.
  const priorSurges = priorHours
    .map((h) => ({ t: new Date(h.time).getTime(), s: surgeFor(h, workingDepthM)?.surgeM ?? null }))
    .filter((p): p is { t: number; s: number } => p.s != null);

  if (priorSurges.length >= 12) {
    const peak = Math.max(...priorSurges.map((p) => p.s));
    const lastRough = priorSurges.filter((p) => p.s > 0.35).at(-1);
    const hoursSince = lastRough ? (dayStartMs - lastRough.t) / 3_600_000 : 999;

    if (peak <= 0.35) {
      add("recovery", 10, "Nothing to recover from — the last three days have been quiet on the bottom.");
    } else {
      const excess = Math.min(Math.max(peak - 0.35, 0), 0.65) / 0.65;
      const recovered = Math.min(Math.max(hoursSince / 60, 0), 1);
      add(
        "recovery",
        clamp10(10 - 8 * excess * (1 - recovered)),
        `Peak bottom surge in the last 72 h was ${Math.round(peak * 100)} cm, easing about ${Math.round(hoursSince)} h before your day. ` +
          "Over rock and kelp visibility can return inside a day; over sand and shingle give it two to three."
      );
    }
  } else {
    add("recovery", null, "Not enough history before this date to judge how the water is recovering.");
  }

  // Wind, at the window.
  const windowWind = mean(sampled.map((h) => h.windSpeedKt).filter((v): v is number => v != null));
  const windDirs = sampled.map((h) => h.windDirectionDeg).filter((v): v is number => v != null);
  const windDir = windDirs.length ? windDirs[Math.floor(windDirs.length / 2)] : null;

  if (windowWind != null) {
    const offshore =
      windDir != null && shoreFacingDeg != null
        ? -Math.cos(((windDir - shoreFacingDeg) * Math.PI) / 180)
        : null;
    const quarter =
      offshore == null
        ? " Set the shore aspect to score direction rather than strength alone — the guide rates direction first."
        : offshore > 0.35
          ? " Blowing offshore, which flattens the surface and holds the water clean."
          : offshore < -0.35
            ? " Blowing onshore, which stirs the inshore water and makes the surface hostile."
            : " Blowing across the site — neither helping nor hurting much.";
    add(
      "wind",
      windScore(windowWind, windDir, shoreFacingDeg),
      `${windowWind.toFixed(0)} kt${windDir != null ? ` from the ${compass(windDir)}` : ""}.${quarter}`
    );
  } else {
    add("wind", null, "No wind forecast for this point.");
  }

  // Wind against stream, at the window.
  const wotScores = sampled
    .map((h) =>
      h.windSpeedKt != null && h.windDirectionDeg != null && h.currentSpeedKt != null && h.currentDirectionDeg != null
        ? { score: windOverTideScore(h.windSpeedKt, h.windDirectionDeg, h.currentSpeedKt, h.currentDirectionDeg), h }
        : null
    )
    .filter((v): v is NonNullable<typeof v> => v != null);

  if (wotScores.length > 0) {
    const avg = mean(wotScores.map((w) => w.score))!;
    const sample = wotScores[0].h;
    const opposed = angleDelta(sample.windDirectionDeg!, sample.currentDirectionDeg!) < 60;
    const geometry = `Wind from the ${compass(sample.windDirectionDeg!)}, stream setting ${compass(sample.currentDirectionDeg!)}`;
    // Opposing geometry only matters once there is enough wind and enough
    // stream to stand the water up, so the wording has to follow the score
    // rather than the angle alone.
    add(
      "windOverTide",
      avg,
      !opposed
        ? `${geometry} — broadly aligned, so the chop stays long and low.`
        : avg >= 8
          ? `${geometry} — opposed, but too light to stand the water up.`
          : `${geometry} — running against each other. Short steep chop, a hard exit and a float you can lose sight of.`
    );
  } else {
    add("windOverTide", null, "No current direction available, so wind-over-tide can't be assessed.");
  }

  // Stream.
  const windowCurrent = mean(sampled.map((h) => h.currentSpeedKt).filter((v): v is number => v != null));
  const windowProximity = mean(
    sampled.map((h) => slackProximityScore(new Date(h.time).getTime(), slackWindows)).filter((v): v is number => v != null)
  );
  const streamBase =
    windowCurrent != null && windowProximity != null
      ? 0.65 * currentScore(windowCurrent) + 0.35 * windowProximity
      : windowCurrent != null
        ? currentScore(windowCurrent)
        : windowProximity;

  if (streamBase != null) {
    const tideState =
      springNeapRatio == null
        ? ""
        : springNeapRatio >= 0.85
          ? " Springs — more food moving, but your window narrows to minutes."
          : springNeapRatio <= 0.55
            ? " Neaps — less sediment moving and a longer, safer slack."
            : " Mid-range tide.";
    add(
      "stream",
      clamp10(streamBase * springNeapMultiplier),
      (windowCurrent != null ? `Modelled stream around ${windowCurrent.toFixed(2)} kt in the window.` : "Scored from slack timing alone.") +
        tideState
    );
  } else {
    add("stream", null, "No tide station or current model near this point.");
  }

  // Light.
  const lightScores = sampled.map((h) => lightScore(localHourOf(h.time), h.cloudCoverPct));
  const avgLight = mean(lightScores);
  const avgCloud = mean(sampled.map((h) => h.cloudCoverPct).filter((v): v is number => v != null));
  add(
    "light",
    avgLight,
    bestWindow
      ? `The window sits ${windowHours.every((h) => h.localHour >= 10 && h.localHour < 16) ? "inside" : "partly outside"} the 10:00-16:00 high sun that reaches into gullies and under ledges.` +
          (avgCloud != null ? ` Cloud cover around ${Math.round(avgCloud)}%.` : "")
      : "No usable daylight hours in the forecast."
  );

  // Season.
  const season = seasonFor(month, lat);
  add("season", season.score, season.note ? `${season.note}.` : "");

  // Rain, which only counts where fresh water actually reaches the site.
  const precip48h = priorHours
    .filter((h) => new Date(h.time).getTime() >= dayStartMs - 48 * 3_600_000)
    .reduce((sum, h) => sum + (h.precipitationMm ?? 0), 0);

  if (estuaryInfluence) {
    add(
      "rain",
      rainScore(precip48h),
      `${precip48h.toFixed(0)} mm of rain in the 48 h before your day. River plumes carry sediment and a freshwater layer that sits on top of clear water and kills the light.`
    );
  } else {
    add(
      "rain",
      null,
      `${precip48h.toFixed(0)} mm of rain in the previous 48 h — not scored, because you haven't marked this site as estuary-influenced.`
    );
  }

  // ---- renormalise weights over the factors that actually have a score ----
  const scored = factors.filter((f) => f.score != null);
  const totalWeight = scored.reduce((sum, f) => sum + BASE_WEIGHTS[f.key], 0);
  for (const factor of factors) {
    factor.weight = factor.score == null || totalWeight === 0 ? 0 : BASE_WEIGHTS[factor.key] / totalWeight;
  }

  const weightedMean = scored.reduce((sum, f) => sum + f.score! * f.weight, 0);

  // A plain weighted mean lets one decisive problem be averaged away by
  // everything else going right, which is the opposite of how the guide reads
  // conditions — the drivers are a sequence, and any one of them can cancel the
  // dive. Shading the mean towards its weakest High-confidence factor keeps a
  // half-metre of long-period groundswell from scoring as a good day just
  // because the tide, light and season all happen to line up.
  const highConfidence = scored.filter((f) => f.confidence === "High").map((f) => f.score!);
  let score = highConfidence.length > 0 ? 0.8 * weightedMean + 0.2 * Math.min(...highConfidence) : weightedMean;

  // ---- what this location's own log says ----------------------------------
  // Everything above is the general model: the same numbers would come out
  // anywhere on the coast. The log is the only thing here that knows this
  // particular site, so when conditions like these have already been dived
  // here it moves the rating towards how they actually went.
  //
  // It is applied before the ceilings below, deliberately. A run of good days
  // in a southwesterly should lift a middling forecast, but it must not be able
  // to lift an unworkable one — the physical caps still have the last word.
  let logAdjustment: TripScore["logAdjustment"] = null;
  if (logEvidence && logEvidence.matches.length > 0 && Math.abs(logEvidence.adjustment) >= 0.1) {
    const forecastOnly = Math.round(clamp10(score) * 10) / 10;
    score = clamp10(score + logEvidence.adjustment);
    logAdjustment = {
      points: logEvidence.adjustment,
      forecastOnly,
      matchCount: logEvidence.matches.length,
      summary: logEvidence.summary,
    };
  }

  // ---- ceilings ----------------------------------------------------------
  // Good tide and good light cannot rescue an unworkable sea, so these cap the
  // rating rather than averaging into it.
  const caps: string[] = [];
  const cap = (limit: number, reason: string) => {
    if (score > limit) {
      score = limit;
      caps.push(reason);
    }
  };

  const windowSurge = windowSurges.length ? mean(windowSurges.map((s) => s.surgeM))! : null;
  if (windowSurge != null && windowSurge > 0.85) {
    cap(2, `About ${Math.round(windowSurge * 100)} cm of bottom surge at ${workingDepthM} m — sand will be up and visibility gone.`);
  } else if (windowSurge != null && windowSurge > 0.6) {
    cap(3.5, `About ${Math.round(windowSurge * 100)} cm of bottom surge at ${workingDepthM} m is past the workable ceiling for shore diving reef.`);
  }

  const windowWave = mean(sampled.map((h) => h.waveHeightM).filter((v): v is number => v != null));
  if (windowWave != null && windowWave > 2) {
    cap(2, `${windowWave.toFixed(1)} m seas — the surface itself is the problem.`);
  }

  if (windowWind != null) {
    const offshore =
      windDir != null && shoreFacingDeg != null ? -Math.cos(((windDir - shoreFacingDeg) * Math.PI) / 180) : null;
    const onshoreKt = offshore != null ? (windowWind * (1 - offshore)) / 2 : windowWind * 0.6;
    if (onshoreKt > 18) {
      cap(3.5, `${windowWind.toFixed(0)} kt of onshore wind makes the surface hostile and the exit hard.`);
    }
  }

  score = Math.round(clamp10(score) * 10) / 10;

  const verdict: TripScore["verdict"] =
    score >= 8 ? "Go" : score >= 6.5 ? "Worth it" : score >= 4.5 ? "Marginal" : "Stay home";

  // ---- confidence in the rating (not in the mechanisms) -------------------
  const missing = factors.filter((f) => f.score == null && !(f.key === "rain" && !estuaryInfluence));
  const reasons: string[] = [];
  let confidence: Confidence = "High";
  const demote = (to: Confidence) => {
    const order = { High: 2, Medium: 1, Low: 0 };
    if (order[to] < order[confidence]) confidence = to;
  };

  if (forecastHorizonDays > 7) {
    demote("Low");
    reasons.push(`${forecastHorizonDays} days out, which is past where a marine forecast means much`);
  } else if (forecastHorizonDays > 3) {
    demote("Medium");
    reasons.push(`${forecastHorizonDays} days out — check again the night before`);
  }
  if (shoreFacingDeg == null) {
    demote("Medium");
    reasons.push("no shore aspect set, so wind is scored on strength rather than direction");
  }
  if (missing.length >= 2) demote("Low");
  else if (missing.length === 1) demote("Medium");
  if (missing.length > 0) reasons.push(`${missing.map((f) => f.label.toLowerCase()).join(" and ")} could not be scored`);

  const confidenceReason = reasons.length
    ? `${reasons[0].charAt(0).toUpperCase()}${reasons[0].slice(1)}${reasons.length > 1 ? `; ${reasons.slice(1).join("; ")}` : ""}.`
    : "Near-term forecast with every factor available and a shore aspect set.";

  return {
    score,
    verdict,
    confidence,
    confidenceReason,
    bestWindow,
    caps,
    logAdjustment,
    factors,
    hourScores,
    recommendations: buildRecommendations({
      factors,
      caps,
      verdict,
      sampled,
      shoreFacingDeg,
      slackWindows,
      estuaryInfluence,
      precip48h,
      workingDepthM,
      logEvidence: logEvidence ?? null,
    }),
  };
}

const FACTOR_LABELS: Record<FactorKey, string> = {
  surge: "Bottom surge",
  recovery: "Recovery since the last blow",
  wind: "Wind",
  windOverTide: "Wind over tide",
  stream: "Stream & slack",
  light: "Light",
  season: "Season",
  rain: "Rainfall & river plume",
};

function buildRecommendations(args: {
  factors: Factor[];
  caps: string[];
  verdict: TripScore["verdict"];
  sampled: HourSample[];
  shoreFacingDeg: number | null;
  slackWindows: SlackWindow[];
  estuaryInfluence: boolean;
  precip48h: number;
  workingDepthM: number;
  logEvidence: LogEvidence | null;
}): Recommendation[] {
  const { factors, caps, sampled, shoreFacingDeg, slackWindows, estuaryInfluence, precip48h, logEvidence } = args;
  const byKey = Object.fromEntries(factors.map((f) => [f.key, f])) as Record<FactorKey, Factor>;
  const out: Recommendation[] = [];

  if (caps.length > 0) {
    out.push({
      title: "This is the call that cancels the dive",
      body: `${caps.join(" ")} A perfect tide on the third day of a southwesterly is still a wasted drive — pick a sheltered aspect or another day.`,
      confidence: "High",
    });
  }

  // Ranked immediately after the ceilings, and ahead of every general rule
  // below, because it is the only evidence here drawn from this actual site.
  if (logEvidence && logEvidence.matches.length > 0 && Math.abs(logEvidence.adjustment) >= 0.1) {
    const closest = logEvidence.matches[0];
    const when = closest.date ? `on ${closest.date}` : "in an undated session";
    const outcome =
      closest.rating != null ? `${closest.rating}/5` : `${closest.catchCount} landed`;

    if (logEvidence.adjustment > 0) {
      out.push({
        title: "You have dived this well before",
        body: `${logEvidence.summary} The closest was ${when}, which you rated ${outcome}. Conditions mean different things at different marks, so your own record here outranks every general rule below — dive your usual plan for these conditions.`,
        confidence: logEvidence.strength >= 0.5 ? "High" : "Medium",
      });
    } else {
      out.push({
        title: "Conditions like these have not worked here",
        body: `${logEvidence.summary} The closest was ${when}, which you rated ${outcome}. The general numbers above may look acceptable, but this mark has already told you otherwise — take the sheltered alternative, or change the window.`,
        confidence: logEvidence.strength >= 0.5 ? "High" : "Medium",
      });
    }
  }

  // Swell direction drives which coast to pick, which is the highest-value
  // decision three days out.
  const swellDir = sampled.map((h) => h.swellDirectionDeg).find((d): d is number => d != null);
  if (swellDir != null) {
    const shelter = compass((swellDir + 180) % 360);
    out.push({
      title: "Pick the shore aspect against the swell",
      body: `Swell is running in from the ${compass(swellDir)}. Dive the coast that faces away from it — ${shelter}-facing bays clean up first and stay diveable while everything exposed is out.`,
      confidence: "High",
    });
  }

  if (slackWindows.length > 0) {
    out.push({
      title: "Take the stream time from a diamond, not this page",
      body:
        "The slack times shown here are the midpoint between tide extremes. The real turn of the stream lags shore high water by one to three hours along this kind of coast, and acutely off headlands — check an Admiralty tidal stream atlas or the tidal diamonds on the chart before you commit to a window.",
      confidence: "High",
    });
  }

  if ((byKey.windOverTide.score ?? 10) < 6) {
    out.push({
      title: "Wind is running against the stream",
      body: "Check wind direction against stream direction before you check wind strength. An opposing current compresses the wavelength while the height grows, so a modest breeze tips into breaking chop — a hostile surface, a hard exit, and a float you cannot see.",
      confidence: "High",
    });
  }

  if ((byKey.recovery.score ?? 10) < 6) {
    out.push({
      title: "The water is still settling",
      body: `${byKey.recovery.detail} Diving the neaps and the slack while it recovers buys you a metre or two of visibility, and moving onto rock and kelp rather than sand buys you a day.`,
      confidence: "Medium",
    });
  }

  if (estuaryInfluence && precip48h > 15) {
    out.push({
      title: "Move away from the estuary rather than waiting it out",
      body: `${precip48h.toFixed(0)} mm of rain in 48 h will have a plume running. Fresh water sits on top of clear water and kills the light, so pick a site clear of river and harbour influence instead.`,
      confidence: "Medium",
    });
  } else if (!estuaryInfluence && precip48h > 25) {
    out.push({
      title: "Heavy rain — worth a thought if there's a river nearby",
      body: `${precip48h.toFixed(0)} mm fell in the 48 h before your day. This isn't in your rating because the site isn't marked estuary-influenced, but if there is a river or harbour upstream of it, expect a plume.`,
      confidence: "Medium",
    });
  }

  if (shoreFacingDeg == null) {
    out.push({
      title: "Set which way the shore faces",
      body: "Wind direction matters more than wind strength — a 10-15 kt northerly flattens the surface and holds the water clean, while the same strength from the south wrecks the day. Without an aspect the rating can only score strength.",
      confidence: "High",
    });
  }

  if ((byKey.season.score ?? 10) >= 9) {
    out.push({
      title: "This is the right end of the season",
      body: "Water temperature lags the air by weeks, so autumn gives the warmest water, the best clarity and the heaviest fish — until the first real gale. If you can only pick a few days a season, pick them here.",
      confidence: "High",
    });
  } else if ((byKey.season.score ?? 10) <= 5) {
    out.push({
      title: "Season is working against you",
      body: `${byKey.season.detail} It is worth going anyway — expect to work close and shoot short.`,
      confidence: "Medium",
    });
  }

  out.push({
    title: "Plan the drift; never plan to swim back",
    body: "Enter upstream, work downstream, exit where the stream puts you. If the plan requires swimming against the stream at any point, it is the wrong plan. Have the exit chosen before you get in.",
    confidence: "High",
  });

  out.push({
    title: "On arrival, look at the water — not this page",
    body: "Surface texture, the colour at the entry, and whether there is sand in the wash. Then drop to your working depth once and look horizontally: under about three metres of horizontal visibility, move to the sheltered plan or go home.",
    confidence: "High",
  });

  return out;
}

/** Factors the guide rates Low — shown so the omission reads as a decision, not an oversight. */
export const NOT_SCORED: { title: string; body: string }[] = [
  {
    title: "Moon phase and solunar tables",
    body: "The moon's real effect on your dive arrives through the tide, which the rating already covers. As an independent predictor of feeding the evidence is thin, and any effect is buried under swell and visibility.",
  },
  {
    title: "Barometric pressure",
    body: "Widely believed, weakly evidenced for inshore sea fish, and confounded — falling pressure usually means wind and swell are coming, which affects your dive far more than the pressure does.",
  },
];
