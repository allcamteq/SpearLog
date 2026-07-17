import type { CategoryRatingStat } from "@/db/queries/stats";
import { ConfidenceBadge } from "@/components/insights2/confidence-badge";

const SCALE_MIN = 1;
const SCALE_MAX = 5;
const SCALE_TICKS = [1, 2, 3, 4, 5];

function percentFor(value: number): number {
  return ((value - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
}

/**
 * Dot plot on a fixed 1–5 scale, replacing the old unbounded bar chart — a bar from 0
 * exaggerates small differences within a narrow 1–5 range. Session count + a confidence
 * badge sit beside each value so a 5.0 from one session doesn't read as stronger than a
 * 4.3 from twelve (we don't have per-session variance to draw a real confidence interval,
 * so the badge is the reliability signal instead).
 */
export function DotPlotChart({ data, emptyLabel }: { data: CategoryRatingStat[]; emptyLabel: string }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {data.map((stat) => (
        <div key={stat.category} className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="w-24 shrink-0 truncate text-sm text-foreground">{stat.category}</div>
          <div className="relative h-5 min-w-[120px] flex-1">
            <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-surface-border" />
            {SCALE_TICKS.map((tick) => (
              <div
                key={tick}
                className="absolute top-1/2 h-1.5 w-px -translate-y-1/2 bg-surface-border"
                style={{ left: `${percentFor(tick)}%` }}
              />
            ))}
            {stat.avgRating != null && (
              <div
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow-sm"
                style={{ left: `${percentFor(stat.avgRating)}%` }}
              />
            )}
          </div>
          <div className="w-10 shrink-0 text-right text-sm font-medium text-foreground">
            {stat.avgRating != null ? stat.avgRating.toFixed(1) : "—"}
          </div>
          <div className="w-20 shrink-0 text-xs text-muted">
            {stat.sessionCount} session{stat.sessionCount === 1 ? "" : "s"}
          </div>
          <ConfidenceBadge count={stat.sessionCount} />
        </div>
      ))}
    </div>
  );
}
