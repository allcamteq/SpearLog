import { and, eq, gte, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, catches, sessionMarks, marks, SEA_CONDITIONS, CURRENT_LEVELS } from "@/db/schema";
import { buildFilters } from "@/db/queries/sessions";
import type { SessionFilterInput } from "@/lib/validation/session";

export type LocationStat = {
  location: string;
  sessionCount: number;
  avgRating: number | null;
};

export type SpeciesStat = {
  species: string;
  totalQuantity: number;
};

export type OverallStats = {
  totalSessions: number;
  totalCatches: number;
  avgRating: number | null;
  topLocation: string | null;
  sessionsWithoutCatches: number;
};

export type LocationCatchStat = {
  location: string;
  totalQuantity: number;
};

export type BreakdownEntry = {
  value: string;
  percentage: number;
  /** Raw observations behind this specific value (the numerator) — e.g. 7 in "7 of 10". */
  count: number;
  /** Total observations the percentage was computed from (the denominator) — lets the UI flag e.g. "100% based on 1" as less reliable than "78% based on 20". */
  total: number;
};

export type FishConditionStat = {
  species: string;
  recordCount: number;
  avgRating: number | null;
  avgFishAbundance: number | null;
  avgVisibility: number | null;
  topMark: BreakdownEntry | null;
  markBreakdown: BreakdownEntry[];
  topTideType: BreakdownEntry | null;
  tideTypeBreakdown: BreakdownEntry[];
  topCurrent: BreakdownEntry | null;
  currentBreakdown: BreakdownEntry[];
  topSeaCondition: BreakdownEntry | null;
  seaConditionBreakdown: BreakdownEntry[];
  topWindCondition: BreakdownEntry | null;
  windConditionBreakdown: BreakdownEntry[];
  topTimeOfDay: BreakdownEntry | null;
  timeOfDayBreakdown: BreakdownEntry[];
};

export type CategoryRatingStat = {
  category: string;
  sessionCount: number;
  avgRating: number | null;
  totalQuantity: number;
};

export type LocationConditionStat = {
  location: string;
  sessionCount: number;
  avgRating: number;
  avgFishAbundance: number | null;
  avgVisibility: number | null;
  topMark: BreakdownEntry | null;
  markBreakdown: BreakdownEntry[];
  topTideType: BreakdownEntry | null;
  tideTypeBreakdown: BreakdownEntry[];
  topCurrent: BreakdownEntry | null;
  currentBreakdown: BreakdownEntry[];
  topSeaCondition: BreakdownEntry | null;
  seaConditionBreakdown: BreakdownEntry[];
  topWindCondition: BreakdownEntry | null;
  windConditionBreakdown: BreakdownEntry[];
  topTimeOfDay: BreakdownEntry | null;
  timeOfDayBreakdown: BreakdownEntry[];
};

export type MarkConditionStat = {
  markName: string;
  catchCount: number;
  sessionCount: number;
  avgRating: number | null;
  avgFishAbundance: number | null;
  topSpecies: BreakdownEntry | null;
  speciesBreakdown: BreakdownEntry[];
  topTideType: BreakdownEntry | null;
  tideTypeBreakdown: BreakdownEntry[];
  topCurrent: BreakdownEntry | null;
  currentBreakdown: BreakdownEntry[];
  topSeaCondition: BreakdownEntry | null;
  seaConditionBreakdown: BreakdownEntry[];
  topWindCondition: BreakdownEntry | null;
  windConditionBreakdown: BreakdownEntry[];
  topWindDirection: BreakdownEntry | null;
  windDirectionBreakdown: BreakdownEntry[];
  topTimeOfDay: BreakdownEntry | null;
  timeOfDayBreakdown: BreakdownEntry[];
};

export async function avgRatingByLocation(userId: number, filters: SessionFilterInput = {}): Promise<LocationStat[]> {
  const rows = await db
    .select({
      location: sessions.location,
      sessionCount: sql<number>`count(*)`,
      avgRating: sql<number | null>`avg(${sessions.rating})`,
    })
    .from(sessions)
    .where(and(buildFilters(userId, filters), isNotNull(sessions.location)))
    .groupBy(sessions.location)
    .orderBy(sql`avg(${sessions.rating}) desc`);

  return rows.map((r) => ({
    location: r.location as string,
    sessionCount: Number(r.sessionCount),
    avgRating: r.avgRating != null ? Number(r.avgRating) : null,
  }));
}

export async function catchCountBySpecies(userId: number, filters: SessionFilterInput = {}): Promise<SpeciesStat[]> {
  const rows = await db
    .select({
      species: catches.species,
      totalQuantity: sql<number>`sum(${catches.quantity})`,
    })
    .from(catches)
    .innerJoin(sessions, eq(catches.sessionId, sessions.id))
    .where(buildFilters(userId, filters))
    .groupBy(catches.species)
    .orderBy(sql`sum(${catches.quantity}) desc`);

  return rows.map((r) => ({
    species: r.species,
    totalQuantity: Number(r.totalQuantity),
  }));
}

export async function overallStats(userId: number, filters: SessionFilterInput = {}): Promise<OverallStats> {
  const [sessionRow] = await db
    .select({
      totalSessions: sql<number>`count(*)`,
      avgRating: sql<number | null>`avg(${sessions.rating})`,
    })
    .from(sessions)
    .where(buildFilters(userId, filters));

  const [catchRow] = await db
    .select({ totalCatches: sql<number | null>`sum(${catches.quantity})` })
    .from(catches)
    .innerJoin(sessions, eq(catches.sessionId, sessions.id))
    .where(buildFilters(userId, filters));

  const [topLocationRow] = await db
    .select({
      location: sessions.location,
      sessionCount: sql<number>`count(*)`,
    })
    .from(sessions)
    .where(and(buildFilters(userId, filters), isNotNull(sessions.location)))
    .groupBy(sessions.location)
    .orderBy(sql`count(*) desc`)
    .limit(1);

  const [noCatchRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessions)
    .where(
      and(
        buildFilters(userId, filters),
        sql`NOT EXISTS (SELECT 1 FROM ${catches} WHERE ${catches.sessionId} = ${sessions.id})`
      )
    );

  return {
    totalSessions: Number(sessionRow?.totalSessions ?? 0),
    totalCatches: Number(catchRow?.totalCatches ?? 0),
    avgRating: sessionRow?.avgRating != null ? Number(sessionRow.avgRating) : null,
    topLocation: topLocationRow?.location ?? null,
    sessionsWithoutCatches: Number(noCatchRow?.count ?? 0),
  };
}

/** The tide stage that has produced the most fish (by quantity) across all catches — an actionable "when should I go" signal rather than a raw breakdown. */
export async function mostProductiveTideStage(
  userId: number,
  filters: SessionFilterInput = {}
): Promise<BreakdownEntry | null> {
  const rows = await db
    .select({ tideType: sessions.tideType, quantity: catches.quantity })
    .from(catches)
    .innerJoin(sessions, eq(catches.sessionId, sessions.id))
    .where(and(buildFilters(userId, filters), isNotNull(sessions.tideType)));

  const breakdown = computeWeightedBreakdown(
    rows.map((r) => ({ value: r.tideType as string, weight: r.quantity }))
  );
  return breakdown[0] ?? null;
}

export async function catchCountByLocation(
  userId: number,
  filters: SessionFilterInput = {}
): Promise<LocationCatchStat[]> {
  const rows = await db
    .select({
      location: sessions.location,
      totalQuantity: sql<number>`sum(${catches.quantity})`,
    })
    .from(catches)
    .innerJoin(sessions, eq(catches.sessionId, sessions.id))
    .where(and(buildFilters(userId, filters), isNotNull(sessions.location)))
    .groupBy(sessions.location)
    .orderBy(sql`sum(${catches.quantity}) desc`);

  return rows.map((r) => ({
    location: r.location as string,
    totalQuantity: Number(r.totalQuantity),
  }));
}

export type LocationSuccessStat = { location: string; successfulSessions: number };

/** Sessions per location that landed at least one fish — the denominator for a "successful sessions %" metric, since raw catch totals favour locations visited more often. */
export async function successfulSessionCountByLocation(
  userId: number,
  filters: SessionFilterInput = {}
): Promise<LocationSuccessStat[]> {
  const rows = await db
    .select({ location: sessions.location, count: sql<number>`count(*)` })
    .from(sessions)
    .where(
      and(
        buildFilters(userId, filters),
        isNotNull(sessions.location),
        sql`EXISTS (SELECT 1 FROM ${catches} WHERE ${catches.sessionId} = ${sessions.id})`
      )
    )
    .groupBy(sessions.location);

  return rows.map((r) => ({ location: r.location as string, successfulSessions: Number(r.count) }));
}

const TIME_OF_DAY_BUCKETS = [
  { label: "Dawn", from: 5, to: 8 },
  { label: "Morning", from: 8, to: 12 },
  { label: "Midday", from: 12, to: 14 },
  { label: "Afternoon", from: 14, to: 18 },
  { label: "Evening", from: 18, to: 21 },
] as const;

function bucketTimeOfDay(time: string | null): string | null {
  const match = time ? /^(\d{1,2}):\d{2}/.exec(time) : null;
  if (!match) return null;
  const hour = Number(match[1]);
  return TIME_OF_DAY_BUCKETS.find((b) => hour >= b.from && hour < b.to)?.label ?? "Night";
}

function computeBreakdown(values: string[]): BreakdownEntry[] {
  if (values.length === 0) return [];
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const total = values.length;
  return [...counts.entries()]
    .map(([value, count]) => ({ value, percentage: Math.round((count / total) * 100), count, total }))
    .sort((a, b) => b.percentage - a.percentage);
}

/** Like computeBreakdown, but weighted by a quantity per entry — e.g. so "top mark" reflects total fish caught there, not just number of catch records. */
function computeWeightedBreakdown(entries: { value: string; weight: number }[]): BreakdownEntry[] {
  if (entries.length === 0) return [];
  const totals = new Map<string, number>();
  let totalWeight = 0;
  for (const { value, weight } of entries) {
    totals.set(value, (totals.get(value) ?? 0) + weight);
    totalWeight += weight;
  }
  if (totalWeight === 0) return [];
  return [...totals.entries()]
    .map(([value, weight]) => ({
      value,
      percentage: Math.round((weight / totalWeight) * 100),
      count: weight,
      total: totalWeight,
    }))
    .sort((a, b) => b.percentage - a.percentage);
}

export async function conditionsByFishType(
  userId: number,
  filters: SessionFilterInput = {}
): Promise<FishConditionStat[]> {
  const rows = await db
    .select({
      species: catches.species,
      markName: marks.name,
      quantity: catches.quantity,
      rating: sessions.rating,
      fishAbundance: sessions.fishAbundance,
      visibility: sessions.visibility,
      tideType: sessions.tideType,
      current: sessions.current,
      seaCondition: sessions.seaCondition,
      windCondition: sessions.windCondition,
      startTime: sessions.startTime,
    })
    .from(catches)
    .innerJoin(sessions, eq(catches.sessionId, sessions.id))
    .leftJoin(marks, eq(catches.markId, marks.id))
    .where(buildFilters(userId, filters));

  const bySpecies = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = bySpecies.get(row.species) ?? [];
    list.push(row);
    bySpecies.set(row.species, list);
  }

  const result: FishConditionStat[] = [];
  for (const [species, entries] of bySpecies) {
    const ratings = entries.map((e) => e.rating).filter((v): v is number => v != null);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

    const visibilities = entries.map((e) => e.visibility).filter((v): v is number => v != null);
    const avgVisibility =
      visibilities.length > 0 ? visibilities.reduce((a, b) => a + b, 0) / visibilities.length : null;

    const fishAbundances = entries.map((e) => e.fishAbundance).filter((v): v is number => v != null);
    const avgFishAbundance =
      fishAbundances.length > 0 ? fishAbundances.reduce((a, b) => a + b, 0) / fishAbundances.length : null;

    const markBreakdown = computeWeightedBreakdown(
      entries
        .filter((e): e is typeof e & { markName: string } => e.markName != null)
        .map((e) => ({ value: e.markName, weight: e.quantity }))
    );
    const tideTypeBreakdown = computeBreakdown(
      entries.map((e): string | null => e.tideType).filter((v): v is string => v != null)
    );
    const currentBreakdown = computeBreakdown(
      entries.map((e): string | null => e.current).filter((v): v is string => v != null)
    );
    const seaConditionBreakdown = computeBreakdown(
      entries.map((e): string | null => e.seaCondition).filter((v): v is string => v != null)
    );
    const windConditionBreakdown = computeBreakdown(
      entries.map((e): string | null => e.windCondition).filter((v): v is string => v != null)
    );
    const timeOfDayBreakdown = computeBreakdown(
      entries.map((e) => bucketTimeOfDay(e.startTime)).filter((v): v is string => v != null)
    );

    result.push({
      species,
      recordCount: entries.length,
      avgRating,
      avgFishAbundance,
      avgVisibility,
      topMark: markBreakdown[0] ?? null,
      markBreakdown,
      topTideType: tideTypeBreakdown[0] ?? null,
      tideTypeBreakdown,
      topCurrent: currentBreakdown[0] ?? null,
      currentBreakdown,
      topSeaCondition: seaConditionBreakdown[0] ?? null,
      seaConditionBreakdown,
      topWindCondition: windConditionBreakdown[0] ?? null,
      windConditionBreakdown,
      topTimeOfDay: timeOfDayBreakdown[0] ?? null,
      timeOfDayBreakdown,
    });
  }

  return result.sort((a, b) => b.recordCount - a.recordCount);
}

export async function avgRatingBySeaCondition(
  userId: number,
  filters: SessionFilterInput = {}
): Promise<CategoryRatingStat[]> {
  const sessionRows = await db
    .select({
      category: sessions.seaCondition,
      sessionCount: sql<number>`count(*)`,
      avgRating: sql<number | null>`avg(${sessions.rating})`,
    })
    .from(sessions)
    .where(and(buildFilters(userId, filters), isNotNull(sessions.seaCondition)))
    .groupBy(sessions.seaCondition);

  const catchRows = await db
    .select({
      category: sessions.seaCondition,
      totalQuantity: sql<number>`sum(${catches.quantity})`,
    })
    .from(catches)
    .innerJoin(sessions, eq(catches.sessionId, sessions.id))
    .where(and(buildFilters(userId, filters), isNotNull(sessions.seaCondition)))
    .groupBy(sessions.seaCondition);

  const quantityByCategory = new Map(catchRows.map((r) => [r.category as string, Number(r.totalQuantity)]));

  return sessionRows
    .map((r) => ({
      category: r.category as string,
      sessionCount: Number(r.sessionCount),
      avgRating: r.avgRating != null ? Number(r.avgRating) : null,
      totalQuantity: quantityByCategory.get(r.category as string) ?? 0,
    }))
    .sort((a, b) => SEA_CONDITIONS.indexOf(a.category as (typeof SEA_CONDITIONS)[number]) - SEA_CONDITIONS.indexOf(b.category as (typeof SEA_CONDITIONS)[number]));
}

export async function avgRatingByCurrent(
  userId: number,
  filters: SessionFilterInput = {}
): Promise<CategoryRatingStat[]> {
  const sessionRows = await db
    .select({
      category: sessions.current,
      sessionCount: sql<number>`count(*)`,
      avgRating: sql<number | null>`avg(${sessions.rating})`,
    })
    .from(sessions)
    .where(and(buildFilters(userId, filters), isNotNull(sessions.current)))
    .groupBy(sessions.current);

  const catchRows = await db
    .select({
      category: sessions.current,
      totalQuantity: sql<number>`sum(${catches.quantity})`,
    })
    .from(catches)
    .innerJoin(sessions, eq(catches.sessionId, sessions.id))
    .where(and(buildFilters(userId, filters), isNotNull(sessions.current)))
    .groupBy(sessions.current);

  const quantityByCategory = new Map(catchRows.map((r) => [r.category as string, Number(r.totalQuantity)]));

  return sessionRows
    .map((r) => ({
      category: r.category as string,
      sessionCount: Number(r.sessionCount),
      avgRating: r.avgRating != null ? Number(r.avgRating) : null,
      totalQuantity: quantityByCategory.get(r.category as string) ?? 0,
    }))
    .sort((a, b) => CURRENT_LEVELS.indexOf(a.category as (typeof CURRENT_LEVELS)[number]) - CURRENT_LEVELS.indexOf(b.category as (typeof CURRENT_LEVELS)[number]));
}

const COMPASS_8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

function compass8(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  return COMPASS_8[Math.round(normalized / 45) % 8];
}

export async function avgRatingByWindDirection(
  userId: number,
  filters: SessionFilterInput = {}
): Promise<CategoryRatingStat[]> {
  const sessionRows = await db
    .select({ windDirection: sessions.windDirection, rating: sessions.rating })
    .from(sessions)
    .where(and(buildFilters(userId, filters), isNotNull(sessions.windDirection)));

  const catchRows = await db
    .select({ windDirection: sessions.windDirection, quantity: catches.quantity })
    .from(catches)
    .innerJoin(sessions, eq(catches.sessionId, sessions.id))
    .where(and(buildFilters(userId, filters), isNotNull(sessions.windDirection)));

  const byDirection = new Map<string, { ratings: number[]; sessionCount: number }>();
  for (const row of sessionRows) {
    const key = compass8(row.windDirection as number);
    const entry = byDirection.get(key) ?? { ratings: [], sessionCount: 0 };
    entry.sessionCount++;
    if (row.rating != null) entry.ratings.push(row.rating);
    byDirection.set(key, entry);
  }

  const quantityByDirection = new Map<string, number>();
  for (const row of catchRows) {
    const key = compass8(row.windDirection as number);
    quantityByDirection.set(key, (quantityByDirection.get(key) ?? 0) + row.quantity);
  }

  return COMPASS_8.filter((d) => byDirection.has(d)).map((direction) => {
    const entry = byDirection.get(direction)!;
    return {
      category: direction,
      sessionCount: entry.sessionCount,
      avgRating: entry.ratings.length > 0 ? entry.ratings.reduce((a, b) => a + b, 0) / entry.ratings.length : null,
      totalQuantity: quantityByDirection.get(direction) ?? 0,
    };
  });
}

export async function bestConditionsByLocation(
  userId: number,
  minRating: number,
  filters: SessionFilterInput = {}
): Promise<LocationConditionStat[]> {
  const rows = await db
    .select({
      location: sessions.location,
      rating: sessions.rating,
      fishAbundance: sessions.fishAbundance,
      visibility: sessions.visibility,
      tideType: sessions.tideType,
      current: sessions.current,
      seaCondition: sessions.seaCondition,
      windCondition: sessions.windCondition,
      startTime: sessions.startTime,
    })
    .from(sessions)
    .where(
      and(
        buildFilters(userId, filters),
        isNotNull(sessions.location),
        or(
          and(isNotNull(sessions.rating), gte(sessions.rating, minRating)),
          and(isNotNull(sessions.fishAbundance), gte(sessions.fishAbundance, minRating))
        )
      )
    );

  // Fetched separately (rather than joined into `rows` above) because a session can
  // have several marks — joining directly would duplicate that session's row per mark
  // and skew avgRating/the other breakdowns.
  const markRows = await db
    .select({ location: sessions.location, markName: marks.name })
    .from(sessions)
    .innerJoin(sessionMarks, eq(sessionMarks.sessionId, sessions.id))
    .innerJoin(marks, eq(sessionMarks.markId, marks.id))
    .where(
      and(
        buildFilters(userId, filters),
        isNotNull(sessions.location),
        or(
          and(isNotNull(sessions.rating), gte(sessions.rating, minRating)),
          and(isNotNull(sessions.fishAbundance), gte(sessions.fishAbundance, minRating))
        )
      )
    );
  const markNamesByLocation = new Map<string, string[]>();
  for (const row of markRows) {
    const key = row.location as string;
    const list = markNamesByLocation.get(key) ?? [];
    list.push(row.markName);
    markNamesByLocation.set(key, list);
  }

  const byLocation = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.location as string;
    const list = byLocation.get(key) ?? [];
    list.push(row);
    byLocation.set(key, list);
  }

  const result: LocationConditionStat[] = [];
  for (const [location, entries] of byLocation) {
    const ratings = entries.map((e) => e.rating).filter((v): v is number => v != null);
    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

    const fishAbundances = entries.map((e) => e.fishAbundance).filter((v): v is number => v != null);
    const avgFishAbundance = fishAbundances.length > 0 ? fishAbundances.reduce((a, b) => a + b, 0) / fishAbundances.length : null;

    const visibilities = entries.map((e) => e.visibility).filter((v): v is number => v != null);
    const avgVisibility =
      visibilities.length > 0 ? visibilities.reduce((a, b) => a + b, 0) / visibilities.length : null;

    const markBreakdown = computeBreakdown(markNamesByLocation.get(location) ?? []);
    const tideTypeBreakdown = computeBreakdown(
      entries.map((e): string | null => e.tideType).filter((v): v is string => v != null)
    );
    const currentBreakdown = computeBreakdown(
      entries.map((e): string | null => e.current).filter((v): v is string => v != null)
    );
    const seaConditionBreakdown = computeBreakdown(
      entries.map((e): string | null => e.seaCondition).filter((v): v is string => v != null)
    );
    const windConditionBreakdown = computeBreakdown(
      entries.map((e): string | null => e.windCondition).filter((v): v is string => v != null)
    );
    const timeOfDayBreakdown = computeBreakdown(
      entries.map((e) => bucketTimeOfDay(e.startTime)).filter((v): v is string => v != null)
    );

    result.push({
      location,
      sessionCount: entries.length,
      avgRating,
      avgFishAbundance,
      avgVisibility,
      topMark: markBreakdown[0] ?? null,
      markBreakdown,
      topTideType: tideTypeBreakdown[0] ?? null,
      tideTypeBreakdown,
      topCurrent: currentBreakdown[0] ?? null,
      currentBreakdown,
      topSeaCondition: seaConditionBreakdown[0] ?? null,
      seaConditionBreakdown,
      topWindCondition: windConditionBreakdown[0] ?? null,
      windConditionBreakdown,
      topTimeOfDay: timeOfDayBreakdown[0] ?? null,
      timeOfDayBreakdown,
    });
  }

  return result.sort((a, b) => b.sessionCount - a.sessionCount || b.avgRating - a.avgRating);
}

/** Condition breakdowns for the most-fished marks (by session count), same shape as bestConditionsByLocation but grouped by mark instead of session.location. */
export async function conditionsByTopMarks(
  userId: number,
  limit: number,
  filters: SessionFilterInput = {}
): Promise<MarkConditionStat[]> {
  const rows = await db
    .select({
      markName: marks.name,
      sessionId: catches.sessionId,
      species: catches.species,
      quantity: catches.quantity,
      rating: sessions.rating,
      fishAbundance: sessions.fishAbundance,
      tideType: sessions.tideType,
      current: sessions.current,
      seaCondition: sessions.seaCondition,
      windCondition: sessions.windCondition,
      windDirection: sessions.windDirection,
      startTime: sessions.startTime,
    })
    .from(catches)
    .innerJoin(sessions, eq(catches.sessionId, sessions.id))
    .innerJoin(marks, eq(catches.markId, marks.id))
    .where(buildFilters(userId, filters));

  const byMark = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byMark.get(row.markName) ?? [];
    list.push(row);
    byMark.set(row.markName, list);
  }

  const result: MarkConditionStat[] = [];
  for (const [markName, entries] of byMark) {
    const ratings = entries.map((e) => e.rating).filter((v): v is number => v != null);
    const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

    const fishAbundances = entries.map((e) => e.fishAbundance).filter((v): v is number => v != null);
    const avgFishAbundance =
      fishAbundances.length > 0 ? fishAbundances.reduce((a, b) => a + b, 0) / fishAbundances.length : null;

    const speciesBreakdown = computeWeightedBreakdown(entries.map((e) => ({ value: e.species, weight: e.quantity })));
    const tideTypeBreakdown = computeBreakdown(
      entries.map((e): string | null => e.tideType).filter((v): v is string => v != null)
    );
    const currentBreakdown = computeBreakdown(
      entries.map((e): string | null => e.current).filter((v): v is string => v != null)
    );
    const seaConditionBreakdown = computeBreakdown(
      entries.map((e): string | null => e.seaCondition).filter((v): v is string => v != null)
    );
    const windConditionBreakdown = computeBreakdown(
      entries.map((e): string | null => e.windCondition).filter((v): v is string => v != null)
    );
    const windDirectionBreakdown = computeBreakdown(
      entries.map((e) => (e.windDirection != null ? compass8(e.windDirection) : null)).filter((v): v is string => v != null)
    );
    const timeOfDayBreakdown = computeBreakdown(
      entries.map((e) => bucketTimeOfDay(e.startTime)).filter((v): v is string => v != null)
    );

    result.push({
      markName,
      catchCount: entries.reduce((sum, e) => sum + e.quantity, 0),
      sessionCount: new Set(entries.map((e) => e.sessionId)).size,
      avgRating,
      avgFishAbundance,
      topSpecies: speciesBreakdown[0] ?? null,
      speciesBreakdown,
      topTideType: tideTypeBreakdown[0] ?? null,
      tideTypeBreakdown,
      topCurrent: currentBreakdown[0] ?? null,
      currentBreakdown,
      topSeaCondition: seaConditionBreakdown[0] ?? null,
      seaConditionBreakdown,
      topWindCondition: windConditionBreakdown[0] ?? null,
      windConditionBreakdown,
      topWindDirection: windDirectionBreakdown[0] ?? null,
      windDirectionBreakdown,
      topTimeOfDay: timeOfDayBreakdown[0] ?? null,
      timeOfDayBreakdown,
    });
  }

  return result.sort((a, b) => b.catchCount - a.catchCount).slice(0, limit);
}
