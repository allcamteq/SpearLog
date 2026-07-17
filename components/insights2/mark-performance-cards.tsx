import Link from "next/link";
import type { MarkConditionStat } from "@/db/queries/stats";
import { ConfidenceBadge } from "@/components/insights2/confidence-badge";
import { TIDE_TYPE_LABELS } from "@/lib/constants";

const tideTypeLabel = (v: string) => TIDE_TYPE_LABELS[v as keyof typeof TIDE_TYPE_LABELS] ?? v;

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export function MarkPerformanceCards({ data }: { data: MarkConditionStat[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted">No catches linked to a mark yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((mark) => (
        <div key={mark.markName} className="flex flex-col rounded-xl border border-surface-border bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-foreground">{mark.markName}</h3>
            <ConfidenceBadge count={mark.catchCount} />
          </div>
          <p className="mt-1 text-xs text-muted">
            {mark.catchCount} catch{mark.catchCount === 1 ? "" : "es"} · {mark.sessionCount} session
            {mark.sessionCount === 1 ? "" : "s"}
            {mark.avgFishAbundance != null && ` · ${mark.avgFishAbundance.toFixed(1)} avg fish abundance`}
          </p>

          <div className="mt-3 flex flex-col gap-1">
            <Fact label="Species" value={mark.topSpecies?.value ?? null} />
            <Fact label="Tide" value={mark.topTideType ? tideTypeLabel(mark.topTideType.value) : null} />
            <Fact label="Current" value={mark.topCurrent?.value ?? null} />
            <Fact label="Sea" value={mark.topSeaCondition?.value ?? null} />
            <Fact
              label="Wind"
              value={
                mark.topWindCondition && mark.topWindDirection
                  ? `${mark.topWindCondition.value} (${mark.topWindDirection.value})`
                  : (mark.topWindCondition?.value ?? mark.topWindDirection?.value ?? null)
              }
            />
            <Fact label="Time" value={mark.topTimeOfDay?.value ?? null} />
          </div>

          <div className="mt-4 flex flex-wrap gap-3 border-t border-surface-border pt-3">
            <Link
              href={`/?mark=${encodeURIComponent(mark.markName)}`}
              className="text-xs font-medium text-accent hover:text-accent-hover"
            >
              View sessions
            </Link>
            <Link
              href={`/marks?focus=${encodeURIComponent(mark.markName)}`}
              className="text-xs font-medium text-accent hover:text-accent-hover"
            >
              Open on map
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
