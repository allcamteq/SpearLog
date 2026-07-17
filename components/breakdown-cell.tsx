import type { BreakdownEntry } from "@/db/queries/stats";

export function BreakdownCell({
  top,
  breakdown,
  labelFor = (v) => v,
  unit = "records",
}: {
  top: BreakdownEntry | null;
  breakdown: BreakdownEntry[];
  labelFor?: (value: string) => string;
  /** Noun for the sample-size caveat, e.g. "catches" / "fish" / "sessions" — so "100%" from a single observation doesn't read as reliable as "78%" from twenty. */
  unit?: string;
}) {
  if (!top) return <span className="text-muted">—</span>;

  const rest = breakdown.slice(1);
  return (
    <div>
      <div>
        {labelFor(top.value)}{" "}
        <span className="text-muted">
          ({top.percentage}%, {top.total} {unit})
        </span>
      </div>
      {rest.length > 0 && (
        <div className="text-xs text-muted">{rest.map((r) => `${labelFor(r.value)} ${r.percentage}%`).join(", ")}</div>
      )}
    </div>
  );
}
