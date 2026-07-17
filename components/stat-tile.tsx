import { cardClass } from "@/lib/ui";

export function StatTile({
  label,
  value,
  className = "",
  valueClassName = "text-2xl",
}: {
  label: string;
  value: string;
  /** Extra classes on the outer card — e.g. "sm:col-span-2" to widen a tile with a long value. */
  className?: string;
  /** Override the value's text size — e.g. for a long value that would otherwise wrap tall. */
  valueClassName?: string;
}) {
  return (
    <div className={`${cardClass} p-4 ${className}`}>
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 font-semibold text-accent ${valueClassName}`}>{value}</div>
    </div>
  );
}
