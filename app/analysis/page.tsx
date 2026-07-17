import { redirect } from "next/navigation";
import {
  avgRatingByLocation,
  avgRatingBySeaCondition,
  avgRatingByCurrent,
  avgRatingByWindDirection,
  bestConditionsByLocation,
  catchCountByLocation,
  catchCountBySpecies,
  conditionsByFishType,
  conditionsByTopMarks,
  mostProductiveTideStage,
  overallStats,
} from "@/db/queries/stats";
import { listAllOptionValues } from "@/db/queries/options";
import { listMarks } from "@/db/queries/marks";
import { parseSessionFilters } from "@/lib/filters";
import { TIDE_TYPE_LABELS } from "@/lib/constants";
import { StatTile } from "@/components/stat-tile";
import { AvgRatingByLocationChart } from "@/components/charts/avg-rating-by-location-chart";
import { CatchCountBySpeciesChart } from "@/components/charts/catch-count-by-species-chart";
import { CatchCountByLocationChart } from "@/components/charts/catch-count-by-location-chart";
import { CategoryRatingChart } from "@/components/charts/category-rating-chart";
import { SessionFilters } from "@/components/session-filters";
import { FishConditionsTable } from "@/components/fish-conditions-table";
import { LocationConditionsTable } from "@/components/location-conditions-table";
import { MarkConditionsTable } from "@/components/mark-conditions-table";
import { getUserId } from "@/lib/auth-helpers";
import { cardClass } from "@/lib/ui";

type SearchParams = Record<string, string | string[] | undefined>;

// Threshold for what counts as a "best" (highly-rated) session in the
// Best conditions by location table below.
const BEST_CONDITIONS_MIN_RATING = 4;

const TOP_MARKS_LIMIT = 10;

const DASHBOARD_FILTER_FIELDS = ["location", "country", "species", "mark"] as const;

export default async function AnalysisPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const rawParams = await searchParams;
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string") usp.set(key, value);
  }

  const filters = parseSessionFilters(usp);

  const [
    stats,
    byLocation,
    bySpecies,
    byLocationFiltered,
    conditions,
    bestConditions,
    topMarksConditions,
    bySeaCondition,
    byCurrent,
    byWindDirection,
    options,
    marks,
    topTideStage,
  ] = await Promise.all([
    overallStats(userId, filters),
    avgRatingByLocation(userId, filters),
    catchCountBySpecies(userId, filters),
    catchCountByLocation(userId, filters),
    conditionsByFishType(userId, filters),
    bestConditionsByLocation(userId, BEST_CONDITIONS_MIN_RATING, filters),
    conditionsByTopMarks(userId, TOP_MARKS_LIMIT, filters),
    avgRatingBySeaCondition(userId, filters),
    avgRatingByCurrent(userId, filters),
    avgRatingByWindDirection(userId, filters),
    listAllOptionValues(userId),
    listMarks(userId),
    mostProductiveTideStage(userId, filters),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">InsightsOld</h1>

      <SessionFilters
        locationOptions={options.location}
        countryOptions={options.country}
        speciesOptions={options.species}
        markOptions={marks.map((m) => m.name)}
        fields={[...DASHBOARD_FILTER_FIELDS]}
        basePath="/analysis"
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatTile label="Total sessions" value={String(stats.totalSessions)} />
        <StatTile label="Total catches" value={String(stats.totalCatches)} />
        <StatTile label="Avg rating" value={stats.avgRating != null ? stats.avgRating.toFixed(1) : "—"} />
        <StatTile label="Top location" value={stats.topLocation ?? "—"} />
        <StatTile label="Sessions without catches" value={String(stats.sessionsWithoutCatches)} />
        <StatTile
          label="Most productive tide stage"
          value={
            topTideStage
              ? `${TIDE_TYPE_LABELS[topTideStage.value as keyof typeof TIDE_TYPE_LABELS] ?? topTideStage.value} (${topTideStage.percentage}%, ${topTideStage.total} fish)`
              : "—"
          }
        />
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-4 text-sm font-semibold">Conditions by species</h2>
        <div className="overflow-x-auto">
          <FishConditionsTable data={conditions} />
        </div>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-1 text-sm font-semibold">Best conditions by location</h2>
        <p className="mb-4 text-xs text-muted">
          Conditions logged on your highest-rated sessions (4★ and up) at each location — a rough guide to what
          &ldquo;good&rdquo; looks like there.
        </p>
        <div className="overflow-x-auto">
          <LocationConditionsTable data={bestConditions} />
        </div>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-1 text-sm font-semibold">Conditions by top 10 marks</h2>
        <p className="mb-4 text-xs text-muted">Your most-productive marks (by catch count) and the conditions logged there.</p>
        <div className="overflow-x-auto">
          <MarkConditionsTable data={topMarksConditions} />
        </div>
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-4 text-sm font-semibold">Catches by location</h2>
        <CatchCountByLocationChart data={byLocationFiltered} />
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-4 text-sm font-semibold">Catches by species</h2>
        <CatchCountBySpeciesChart data={bySpecies} />
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-4 text-sm font-semibold">Average rating by location</h2>
        <AvgRatingByLocationChart data={byLocation} />
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-1 text-sm font-semibold">Average rating by sea condition</h2>
        <p className="mb-4 text-xs text-muted">How session ratings trend with the sea state you logged.</p>
        <CategoryRatingChart data={bySeaCondition} emptyLabel="No sessions with a sea condition logged yet." />
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-1 text-sm font-semibold">Average rating by current</h2>
        <p className="mb-4 text-xs text-muted">How session ratings trend with current strength.</p>
        <CategoryRatingChart data={byCurrent} emptyLabel="No sessions with a current level logged yet." />
      </section>

      <section className={`${cardClass} p-5`}>
        <h2 className="mb-1 text-sm font-semibold">Average rating by wind direction</h2>
        <p className="mb-4 text-xs text-muted">
          How session ratings trend with wind direction (grouped into 8 compass points).
        </p>
        <CategoryRatingChart data={byWindDirection} emptyLabel="No sessions with a wind direction logged yet." />
      </section>
    </div>
  );
}
