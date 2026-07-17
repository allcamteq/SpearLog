import type { FishConditionStat, CategoryRatingStat } from "@/db/queries/stats";
import type { LocationPerformance } from "@/components/insights2/location-performance-cards";
import { TIDE_TYPE_LABELS } from "@/lib/constants";

export type Insight = { title: string; body: string };

const tideTypeLabel = (v: string) => TIDE_TYPE_LABELS[v as keyof typeof TIDE_TYPE_LABELS] ?? v;

// Small sample threshold used to decide when an observation should be flagged as
// limited rather than stated plainly — kept conservative on purpose (see module docs below).
const LOW_SAMPLE_THRESHOLD = 8;

/**
 * Rule-based (not statistical/ML) narrative observations from data already on the page.
 * Deliberately conservative: each one states what was observed and how much data it's
 * based on, rather than predicting what will happen next.
 */
export function buildNarrativeInsights(
  conditions: FishConditionStat[],
  locationPerformance: LocationPerformance[],
  byCurrent: CategoryRatingStat[]
): Insight[] {
  const insights: Insight[] = [];

  const topSpecies = [...conditions].sort((a, b) => b.recordCount - a.recordCount)[0];
  if (topSpecies?.topTideType && topSpecies.topTideType.total >= 3) {
    const tide = tideTypeLabel(topSpecies.topTideType.value);
    insights.push({
      title: `${topSpecies.species} pattern`,
      body: `${topSpecies.topTideType.percentage}% of recorded ${topSpecies.species} catches occurred during ${tide}. This is based on ${topSpecies.topTideType.total} catches.`,
    });
  }

  const topLocation = [...locationPerformance]
    .filter((l) => l.avgRating != null)
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))[0];
  if (topLocation && topLocation.sessionCount < LOW_SAMPLE_THRESHOLD) {
    insights.push({
      title: "Location opportunity",
      body: `${topLocation.location} has the highest average rating (${topLocation.avgRating!.toFixed(1)}★), but only ${topLocation.sessionCount} session${topLocation.sessionCount === 1 ? "" : "s"} ${topLocation.sessionCount === 1 ? "has" : "have"} been recorded there.`,
    });
  }

  const topCurrent = [...byCurrent].filter((c) => c.avgRating != null).sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0))[0];
  if (topCurrent) {
    const caveat = topCurrent.sessionCount < LOW_SAMPLE_THRESHOLD ? ", although the sample size is limited" : "";
    insights.push({
      title: "Current strength",
      body: `${topCurrent.category} current sessions received the highest average rating (${topCurrent.avgRating!.toFixed(1)})${caveat} (${topCurrent.sessionCount} session${topCurrent.sessionCount === 1 ? "" : "s"}).`,
    });
  }

  return insights;
}

export function NarrativeInsightCards({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {insights.map((insight) => (
        <div key={insight.title} className="rounded-xl border border-accent/25 bg-accent-soft/40 p-4">
          <h3 className="mb-1 text-sm font-semibold text-foreground">{insight.title}</h3>
          <p className="text-xs text-muted">{insight.body}</p>
        </div>
      ))}
    </div>
  );
}
