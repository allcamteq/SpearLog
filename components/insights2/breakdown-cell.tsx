import type { BreakdownEntry } from "@/db/queries/stats";
import { ConfidenceBadge } from "@/components/insights2/confidence-badge";

export function BreakdownCell({
  top,
  breakdown,
  labelFor = (v) => v,
}: {
  top: BreakdownEntry | null;
  breakdown: BreakdownEntry[];
  labelFor?: (value: string) => string;
}) {
  if (!top) return <span className="text-muted">—</span>;

  const rest = breakdown.slice(1);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span>{labelFor(top.value)}</span>
        <span className="text-xs text-muted">
          {top.percentage}% · {top.count} of {top.total}
        </span>
        <ConfidenceBadge count={top.total} />
      </div>
      {rest.length > 0 && (
        <div className="mt-0.5 text-xs text-muted">{rest.map((r) => `${labelFor(r.value)} ${r.percentage}%`).join(", ")}</div>
      )}
    </div>
  );
}
