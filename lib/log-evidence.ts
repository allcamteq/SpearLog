/**
 * Weighs a prospective day against what the user's own logbook recorded at the
 * same location.
 *
 * lib/trip-score.ts encodes a general conditions guide: it is the same model
 * wherever you point it. But how a given set of conditions actually plays out
 * is a property of the individual site. A 12 kt northerly flattens one bay and
 * funnels straight into the next one along; a spring ebb that ruins a sandy
 * cove is what finally clears a kelp reef. Those relationships don't transfer
 * between sites, so the only way to learn them is to read the log for *this*
 * location — which is why the guide rates twenty entries for your own marks
 * above every general rule on the page.
 *
 * So this module answers one question: when conditions looked like this here
 * before, how did it go? It then nudges the forecast rating towards that
 * answer. Two properties keep that honest:
 *
 *  1. **Closeness is weighted, not thresholded.** A near-identical day counts
 *     for much more than a vaguely similar one, and anything below
 *     MIN_SIMILARITY counts for nothing at all.
 *  2. **A small sample is never fully trusted.** `strength` saturates, so one
 *     good day shifts the rating a little and eight shift it a lot — but the
 *     log can never swing the rating more than MAX_SWING points, and it is
 *     applied before the physical ceilings in trip-score, so a history of
 *     great days can't talk you into unworkable swell.
 *
 * Pure: no I/O, no clock reads.
 */

import { CURRENT_LEVELS, SEA_CONDITIONS, TIDE_TYPES, WIND_CONDITIONS } from "@/db/schema";
import { bucketCurrentLevel } from "@/lib/tide-derivation";

type TideType = (typeof TIDE_TYPES)[number];
type CurrentLevel = (typeof CURRENT_LEVELS)[number];
type SeaCondition = (typeof SEA_CONDITIONS)[number];
type WindCondition = (typeof WIND_CONDITIONS)[number];

/** A logged session at the target location, reduced to what can be compared or scored. */
export type LoggedSession = {
  id: number;
  date: string | null;
  tideType: TideType | null;
  /** Range in metres between the extremes bracketing the session. Comparable within a location, not across them. */
  tideRatio: number | null;
  current: CurrentLevel | null;
  currentSpeedKt: number | null;
  seaCondition: SeaCondition | null;
  windCondition: WindCondition | null;
  /** Degrees, meteorological "from" convention. */
  windDirection: number | null;
  /** 1-12, from the session date. Null when the session has no date. */
  month: number | null;
  rating: number | null;
  fishAbundance: number | null;
  /** Total quantity landed across every catch on the session. */
  catchCount: number;
  visibility: number | null;
};

/** The prospective day expressed in the same vocabulary the logbook uses, so the two can be compared directly. */
export type ConditionSnapshot = {
  tideType: TideType | null;
  tideRatio: number | null;
  current: CurrentLevel | null;
  currentSpeedKt: number | null;
  seaCondition: SeaCondition | null;
  windCondition: WindCondition | null;
  windDirectionDeg: number | null;
  month: number;
};

export type SessionMatch = {
  id: number;
  date: string | null;
  /** 0-1, over the dimensions both days actually recorded. */
  similarity: number;
  /** -1 (bad day) to +1 (good day). */
  outcome: number;
  rating: number | null;
  fishAbundance: number | null;
  catchCount: number;
  visibility: number | null;
  /** Dimensions that lined up closely, already labelled for display. */
  sharedConditions: string[];
};

export type LogEvidence = {
  /** Comparable sessions, closest first. */
  matches: SessionMatch[];
  /** Sessions at the location carrying a usable outcome, whether or not they matched. */
  comparedCount: number;
  /** -1 to +1: how the matches turned out, weighted towards the closest. */
  signal: number;
  /** 0-1: how far the matches are worth trusting, from their count and closeness. */
  strength: number;
  /** Points added to or taken off the forecast rating. */
  adjustment: number;
  /** One sentence, for the score breakdown and the log section. */
  summary: string;
};

/**
 * How much each dimension counts towards similarity. Wind direction leads
 * because it is the most site-specific thing the log records — the same
 * strength from two different quarters is two different days at one mark, and
 * identical days at another. Season is last because it is a weak proxy for
 * water temperature and fish behaviour that the general model already scores.
 */
const DIMENSION_WEIGHTS = {
  windDirection: 0.26,
  seaCondition: 0.18,
  windCondition: 0.16,
  current: 0.14,
  tideType: 0.14,
  tideRatio: 0.07,
  season: 0.05,
} as const;

const DIMENSION_LABELS: Record<keyof typeof DIMENSION_WEIGHTS, string> = {
  windDirection: "wind direction",
  seaCondition: "sea state",
  windCondition: "wind strength",
  current: "current",
  tideType: "tide state",
  tideRatio: "tide range",
  season: "time of year",
};

/** Below this, two days aren't the same kind of day and the session is ignored. */
const MIN_SIMILARITY = 0.5;

/**
 * Some dimensions disqualify a comparison outright rather than merely scoring
 * low on it. A weighted mean would let six matching dimensions average away a
 * wind blowing from the opposite quarter, and the resulting "comparable day" is
 * nothing of the kind: at a shore site the wind's quarter decides whether the
 * mark is sheltered or exposed, and a calm day has nothing to say about a very
 * rough one. Keyed by the similarity below which the session is dropped.
 *
 * Tide state is deliberately absent — it cycles, every state gets dived, and
 * its weight is enough to express the difference.
 */
const VETO_BELOW: Partial<Record<keyof typeof DIMENSION_WEIGHTS, number>> = {
  windDirection: 0.25, // more than ~67° off the quarter
  seaCondition: 0.5, // two buckets apart, e.g. calm against very rough
  windCondition: 0.5, // two buckets apart, e.g. calm against strong
  current: 0.34, // opposite ends of the scale, e.g. zero against high
};

/** Below this the log has no material effect — 0.1 is the rating's display granularity. */
const MIN_MATERIAL_ADJUSTMENT = 0.1;

/** Without this much shared weight the overlap is too thin to call it a comparison. */
const MIN_COVERAGE = 0.35;

/** The most the log can move the rating, in points. */
const MAX_SWING = 2;

/**
 * Sessions needed for the log to reach half its possible influence. Low on
 * purpose — a handful of near-identical days at one mark is genuinely strong
 * evidence — but it keeps a single session from dominating.
 */
const EVIDENCE_HALF_LIFE = 2;

/** How the outcome signals divide up. The diver's own rating leads; catches sharpen it. */
const OUTCOME_WEIGHTS = { rating: 0.5, fishAbundance: 0.25, catches: 0.25 } as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Similarity across an ordered scale — adjacent buckets are close, opposite ends are not. */
function ordinalSimilarity<T extends string>(order: readonly T[], a: T, b: T): number {
  const i = order.indexOf(a);
  const j = order.indexOf(b);
  if (i < 0 || j < 0) return 0;
  return 1 - Math.abs(i - j) / (order.length - 1);
}

/**
 * Tide state is a cycle, not a scale: "Low to High" sits next to "High", not
 * two steps from it. Distance is measured around the cycle, so adjacent states
 * score 0.5 and opposite ones 0.
 */
function tideTypeSimilarity(a: TideType, b: TideType): number {
  const i = TIDE_TYPES.indexOf(a);
  const j = TIDE_TYPES.indexOf(b);
  if (i < 0 || j < 0) return 0;
  const direct = Math.abs(i - j);
  const around = Math.min(direct, TIDE_TYPES.length - direct);
  return 1 - around / 2;
}

/**
 * Angular similarity, reaching zero at 90°. A quarter turn in wind direction
 * changes which way the shore is working, so beyond that the two days have
 * nothing to say about each other.
 */
function angularSimilarity(a: number, b: number): number {
  const delta = Math.abs(((((a - b) % 360) + 540) % 360) - 180);
  return Math.max(0, 1 - delta / 90);
}

/** Months are circular; three months apart is a different season entirely. */
function monthSimilarity(a: number, b: number): number {
  const direct = Math.abs(a - b);
  const around = Math.min(direct, 12 - direct);
  return Math.max(0, 1 - around / 3);
}

/** Relative difference, so it works on tide ranges of 1 m and of 6 m alike. */
function relativeSimilarity(a: number, b: number): number {
  const scale = (Math.abs(a) + Math.abs(b)) / 2;
  if (scale < 0.05) return 1;
  return Math.max(0, 1 - Math.abs(a - b) / scale);
}

/**
 * How the day went, from -1 to +1, with 0 meaning unremarkable. A session
 * needs a rating or a fish-abundance score to count at all: catch count alone
 * can't separate "nothing was there" from "wasn't hunting".
 */
function sessionOutcome(session: LoggedSession): number | null {
  if (session.rating == null && session.fishAbundance == null) return null;

  const parts: { value: number; weight: number }[] = [];
  if (session.rating != null) {
    parts.push({ value: clamp((session.rating - 3) / 2, -1, 1), weight: OUTCOME_WEIGHTS.rating });
  }
  if (session.fishAbundance != null) {
    parts.push({ value: clamp((session.fishAbundance - 3) / 2, -1, 1), weight: OUTCOME_WEIGHTS.fishAbundance });
  }
  // A blank day is mildly negative rather than strongly so — plenty of good
  // dives end with an empty stringer. Landing anything at all is the clearer
  // signal, and it saturates fast: six fish is not twice the evidence of three.
  const catchSignal =
    session.catchCount === 0 ? -0.3 : Math.min(1, 0.3 + 0.7 * Math.tanh(session.catchCount / 3));
  parts.push({ value: catchSignal, weight: OUTCOME_WEIGHTS.catches });

  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0);
  return parts.reduce((sum, p) => sum + p.value * p.weight, 0) / totalWeight;
}

type Comparison = { similarity: number; shared: string[] };

/** Similarity over the dimensions both days recorded, renormalised over that overlap. Null when the days aren't comparable at all. */
function compare(snapshot: ConditionSnapshot, session: LoggedSession): Comparison | null {
  let weighted = 0;
  let coverage = 0;
  let vetoed = false;
  const shared: string[] = [];

  const add = (dimension: keyof typeof DIMENSION_WEIGHTS, similarity: number) => {
    const veto = VETO_BELOW[dimension];
    if (veto != null && similarity < veto) vetoed = true;
    const weight = DIMENSION_WEIGHTS[dimension];
    weighted += similarity * weight;
    coverage += weight;
    if (similarity >= 0.7) shared.push(DIMENSION_LABELS[dimension]);
  };

  if (snapshot.windDirectionDeg != null && session.windDirection != null) {
    add("windDirection", angularSimilarity(snapshot.windDirectionDeg, session.windDirection));
  }
  if (snapshot.seaCondition && session.seaCondition) {
    add("seaCondition", ordinalSimilarity(SEA_CONDITIONS, snapshot.seaCondition, session.seaCondition));
  }
  if (snapshot.windCondition && session.windCondition) {
    add("windCondition", ordinalSimilarity(WIND_CONDITIONS, snapshot.windCondition, session.windCondition));
  }
  // Prefer the raw speeds when both days have them: "Low" spans 0-0.5 kt, and
  // the difference between 0.1 and 0.5 kt is the difference between a drift you
  // choose and one you don't.
  if (snapshot.currentSpeedKt != null && session.currentSpeedKt != null) {
    add("current", relativeSimilarity(snapshot.currentSpeedKt, session.currentSpeedKt));
  } else {
    const snapshotLevel =
      snapshot.current ?? (snapshot.currentSpeedKt != null ? bucketCurrentLevel(snapshot.currentSpeedKt) : null);
    const sessionLevel =
      session.current ?? (session.currentSpeedKt != null ? bucketCurrentLevel(session.currentSpeedKt) : null);
    if (snapshotLevel && sessionLevel) {
      add("current", ordinalSimilarity(CURRENT_LEVELS, snapshotLevel, sessionLevel));
    }
  }
  if (snapshot.tideType && session.tideType) {
    add("tideType", tideTypeSimilarity(snapshot.tideType, session.tideType));
  }
  if (snapshot.tideRatio != null && session.tideRatio != null) {
    add("tideRatio", relativeSimilarity(snapshot.tideRatio, session.tideRatio));
  }
  if (session.month != null) {
    add("season", monthSimilarity(snapshot.month, session.month));
  }

  if (vetoed || coverage < MIN_COVERAGE) return null;
  return { similarity: weighted / coverage, shared };
}

function describe(matches: SessionMatch[], signal: number, adjustment: number, comparedCount: number): string {
  if (comparedCount === 0) {
    return "No rated sessions logged here yet, so the rating is the general model only.";
  }
  if (matches.length === 0) {
    return `None of your ${comparedCount} rated session${comparedCount === 1 ? "" : "s"} here were dived in conditions close enough to compare, so the rating is the general model only.`;
  }

  const count = `${matches.length} comparable session${matches.length === 1 ? "" : "s"}`;
  const points = Math.abs(adjustment).toFixed(1);

  if (Math.abs(adjustment) < MIN_MATERIAL_ADJUSTMENT) {
    return `${count} here, and they came out mixed — nothing to add to or take off the forecast rating.`;
  }
  if (signal > 0) {
    return `${count} here in conditions like this went well, adding ${points} to the rating.`;
  }
  return `${count} here in conditions like this went badly, taking ${points} off the rating.`;
}

/**
 * Compares a prospective day against the log for one location.
 *
 * `sessions` must already be filtered to the target location — the whole point
 * is that conditions mean different things at different sites, so mixing marks
 * would wash out exactly the signal being looked for.
 */
export function matchLogEvidence(snapshot: ConditionSnapshot, sessions: LoggedSession[]): LogEvidence {
  const scored: { match: SessionMatch; weight: number }[] = [];
  let comparedCount = 0;

  for (const session of sessions) {
    const outcome = sessionOutcome(session);
    if (outcome == null) continue;
    comparedCount++;

    const comparison = compare(snapshot, session);
    if (!comparison || comparison.similarity < MIN_SIMILARITY) continue;

    // Rescaled so MIN_SIMILARITY contributes nothing and 1 contributes fully,
    // then curved to favour the closest days over a crowd of vague ones.
    const weight = Math.pow((comparison.similarity - MIN_SIMILARITY) / (1 - MIN_SIMILARITY), 1.5);
    if (weight <= 0) continue;

    scored.push({
      weight,
      match: {
        id: session.id,
        date: session.date,
        similarity: Math.round(comparison.similarity * 100) / 100,
        outcome: Math.round(outcome * 100) / 100,
        rating: session.rating,
        fishAbundance: session.fishAbundance,
        catchCount: session.catchCount,
        visibility: session.visibility,
        sharedConditions: comparison.shared,
      },
    });
  }

  const mass = scored.reduce((sum, s) => sum + s.weight, 0);
  const signal = mass > 0 ? scored.reduce((sum, s) => sum + s.match.outcome * s.weight, 0) / mass : 0;
  const strength = mass > 0 ? mass / (mass + EVIDENCE_HALF_LIFE) : 0;
  const adjustment = clamp(MAX_SWING * signal * strength, -MAX_SWING, MAX_SWING);

  const matches = scored
    .sort((a, b) => b.match.similarity - a.match.similarity)
    .map((s) => s.match);

  return {
    matches,
    comparedCount,
    signal: Math.round(signal * 100) / 100,
    strength: Math.round(strength * 100) / 100,
    adjustment: Math.round(adjustment * 100) / 100,
    summary: describe(matches, signal, adjustment, comparedCount),
  };
}
