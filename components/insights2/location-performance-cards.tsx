import type { LocationConditionStat, LocationStat, LocationCatchStat, LocationSuccessStat } from "@/db/queries/stats";
import { ConfidenceBadge } from "@/components/insights2/confidence-badge";
import { TIDE_TYPE_LABELS } from "@/lib/constants";

export type LocationPerformance = {
  location: string;
  sessionCount: number;
  avgRating: number | null;
  totalCatches: number;
  catchRate: number | null;
  successfulSessions: number;
  successRate: number | null;
  bestConditions: LocationConditionStat | null;
};

/**
 * Merges avgRatingByLocation + catchCountByLocation + successfulSessionCountByLocation +
 * bestConditionsByLocation (four separately-fetched, location-keyed datasets) into one row
 * per location — replacing three overlapping widgets (Best conditions by location / Average
 * rating by location / Catches by location) with a single "Location performance" view.
 */
export function buildLocationPerformance(
  byLocation: LocationStat[],
  catchByLocation: LocationCatchStat[],
  successByLocation: LocationSuccessStat[],
  bestConditions: LocationConditionStat[]
): LocationPerformance[] {
  const catchMap = new Map(catchByLocation.map((c) => [c.location, c.totalQuantity]));
  const successMap = new Map(successByLocation.map((s) => [s.location, s.successfulSessions]));
  const bestMap = new Map(bestConditions.map((b) => [b.location, b]));

  return byLocation
    .map((loc) => {
      const totalCatches = catchMap.get(loc.location) ?? 0;
      const successfulSessions = successMap.get(loc.location) ?? 0;
      return {
        location: loc.location,
        sessionCount: loc.sessionCount,
        avgRating: loc.avgRating,
        totalCatches,
        catchRate: loc.sessionCount > 0 ? totalCatches / loc.sessionCount : null,
        successfulSessions,
        successRate: loc.sessionCount > 0 ? Math.round((successfulSessions / loc.sessionCount) * 100) : null,
        bestConditions: bestMap.get(loc.location) ?? null,
      };
    })
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-surface-border bg-surface-border/30 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">
      {children}
    </span>
  );
}

const tideTypeLabel = (v: string) => TIDE_TYPE_LABELS[v as keyof typeof TIDE_TYPE_LABELS] ?? v;

export function LocationPerformanceCards({ data }: { data: LocationPerformance[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted">No sessions with a location logged yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {data.map((loc) => (
        <div key={loc.location} className="rounded-xl border border-surface-border bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground">{loc.location}</h3>
            <ConfidenceBadge count={loc.sessionCount} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {loc.avgRating != null ? `${loc.avgRating.toFixed(1)} ★` : "No rated sessions"} · {loc.sessionCount} session
            {loc.sessionCount === 1 ? "" : "s"}
            {loc.catchRate != null && ` · ${loc.catchRate.toFixed(1)} catches/session`}
          </p>
          {loc.successRate != null && (
            <p className="mt-0.5 text-xs text-muted">
              {loc.successRate}% successful sessions ({loc.successfulSessions} of {loc.sessionCount})
            </p>
          )}

          {loc.bestConditions ? (
            <div className="mt-3">
              <p className="mb-1.5 text-xs text-muted">Best observed conditions (from your highest-rated sessions):</p>
              <div className="flex flex-wrap gap-1.5">
                {loc.bestConditions.topTideType && <Chip>{tideTypeLabel(loc.bestConditions.topTideType.value)}</Chip>}
                {loc.bestConditions.topCurrent && <Chip>{loc.bestConditions.topCurrent.value} current</Chip>}
                {loc.bestConditions.topSeaCondition && <Chip>{loc.bestConditions.topSeaCondition.value} sea</Chip>}
                {loc.bestConditions.topWindCondition && <Chip>{loc.bestConditions.topWindCondition.value} wind</Chip>}
                {loc.bestConditions.topTimeOfDay && <Chip>{loc.bestConditions.topTimeOfDay.value}</Chip>}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted">Not enough highly-rated sessions yet to identify best conditions.</p>
          )}
        </div>
      ))}
    </div>
  );
}
