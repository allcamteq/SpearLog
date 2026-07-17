import { redirect } from "next/navigation";
import {
  avgRatingByLocation,
  avgRatingByCurrent,
  bestConditionsByLocation,
  catchCountByLocation,
  catchCountBySpecies,
  conditionsByFishType,
  conditionsByTopMarks,
  overallStats,
  successfulSessionCountByLocation,
} from "@/db/queries/stats";
import { listAllOptionValues } from "@/db/queries/options";
import { listMarks } from "@/db/queries/marks";
import { parseSessionFilters } from "@/lib/filters";
import { StatTile } from "@/components/stat-tile";
import { CatchCountBySpeciesChart } from "@/components/charts/catch-count-by-species-chart";
import { SessionFilters } from "@/components/session-filters";
import { FishConditionsTable } from "@/components/insights2/fish-conditions-table";
import { MarkPerformanceCards } from "@/components/insights2/mark-performance-cards";
import { LocationPerformanceCards, buildLocationPerformance } from "@/components/insights2/location-performance-cards";
import { LocationCatchesToggleChart } from "@/components/insights2/location-catches-toggle-chart";
import { NarrativeInsightCards, buildNarrativeInsights } from "@/components/insights2/narrative-insights";
import { Insights2Tabs } from "@/components/insights2/tabs";
import { INSIGHTS2_TABS, type Insights2TabKey } from "@/components/insights2/tabs-config";
import { getUserId } from "@/lib/auth-helpers";
import { cardClass } from "@/lib/ui";

type SearchParams = Record<string, string | string[] | undefined>;

// Threshold for what counts as a "best" (highly-rated) session in the
// Best conditions by location table below.
const BEST_CONDITIONS_MIN_RATING = 4;

const TOP_MARKS_LIMIT = 10;

const DASHBOARD_FILTER_FIELDS = ["location", "country", "species", "mark"] as const;

function parseTab(value: string | string[] | undefined): Insights2TabKey {
  const found = INSIGHTS2_TABS.find((t) => t.key === value);
  return found ? found.key : "overview";
}

export default async function Insights2Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const rawParams = await searchParams;
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string") usp.set(key, value);
  }

  const tab = parseTab(rawParams.tab);
  const filters = parseSessionFilters(usp);

  const [
    stats,
    byLocation,
    bySpecies,
    byLocationFiltered,
    conditions,
    bestConditions,
    topMarksConditions,
    byCurrent,
    options,
    marks,
    successByLocation,
  ] = await Promise.all([
    overallStats(userId, filters),
    avgRatingByLocation(userId, filters),
    catchCountBySpecies(userId, filters),
    catchCountByLocation(userId, filters),
    conditionsByFishType(userId, filters),
    bestConditionsByLocation(userId, BEST_CONDITIONS_MIN_RATING, filters),
    conditionsByTopMarks(userId, TOP_MARKS_LIMIT, filters),
    avgRatingByCurrent(userId, filters),
    listAllOptionValues(userId),
    listMarks(userId),
    successfulSessionCountByLocation(userId, filters),
  ]);

  const locationPerformance = buildLocationPerformance(byLocation, byLocationFiltered, successByLocation, bestConditions);
  const narrativeInsights = buildNarrativeInsights(conditions, locationPerformance, byCurrent);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Insights</h1>

      <SessionFilters
        locationOptions={options.location}
        countryOptions={options.country}
        speciesOptions={options.species}
        markOptions={marks.map((m) => m.name)}
        fields={[...DASHBOARD_FILTER_FIELDS]}
        basePath="/insights2"
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatTile label="Total sessions" value={String(stats.totalSessions)} />
        <StatTile label="Total catches" value={String(stats.totalCatches)} />
        <StatTile label="Avg rating" value={stats.avgRating != null ? stats.avgRating.toFixed(1) : "—"} />
        <StatTile label="Top location" value={stats.topLocation ?? "—"} />
      </section>

      <Insights2Tabs active={tab} />

      {tab === "overview" && (
        <div className="flex flex-col gap-4">
          <NarrativeInsightCards insights={narrativeInsights} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <section className={`${cardClass} p-4`}>
              <h2 className="mb-2 text-sm font-semibold">Catches by species</h2>
              <CatchCountBySpeciesChart data={bySpecies} />
            </section>

            <section className={`${cardClass} p-4`}>
              <h2 className="mb-2 text-sm font-semibold">Catches by location</h2>
              <LocationCatchesToggleChart data={locationPerformance} />
            </section>
          </div>

          <section className={`${cardClass} p-4`}>
            <h2 className="mb-1 text-sm font-semibold">Conditions by top 10 marks</h2>
            <p className="mb-3 text-xs text-muted">Your most-productive marks (by catch count) and the conditions logged there.</p>
            <MarkPerformanceCards data={topMarksConditions} />
          </section>
        </div>
      )}

      {tab === "locations" && (
        <div className="flex flex-col gap-4">
          <section className={`${cardClass} p-4`}>
            <h2 className="mb-1 text-sm font-semibold">Location performance</h2>
            <p className="mb-3 text-xs text-muted">
              Rating, activity, and the conditions behind your highest-rated sessions — combined so you can compare
              locations without duplicated widgets.
            </p>
            <LocationPerformanceCards data={locationPerformance} />
          </section>
        </div>
      )}

      {tab === "species" && (
        <div className="flex flex-col gap-4">
          <section className={`${cardClass} p-4`}>
            <h2 className="mb-2 text-sm font-semibold">Conditions by species</h2>
            <div className="overflow-x-auto">
              <FishConditionsTable data={conditions} />
            </div>
          </section>

          <section className={`${cardClass} p-4`}>
            <h2 className="mb-2 text-sm font-semibold">Catches by species</h2>
            <CatchCountBySpeciesChart data={bySpecies} />
          </section>
        </div>
      )}

      {tab === "marks" && (
        <div className="flex flex-col gap-4">
          <section className={`${cardClass} p-4`}>
            <h2 className="mb-1 text-sm font-semibold">Conditions by top 10 marks</h2>
            <p className="mb-3 text-xs text-muted">Your most-productive marks (by catch count) and the conditions logged there.</p>
            <MarkPerformanceCards data={topMarksConditions} />
          </section>
        </div>
      )}
    </div>
  );
}
