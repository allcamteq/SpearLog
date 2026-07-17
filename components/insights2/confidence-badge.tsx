export type Confidence = "low" | "medium" | "high";

/** 1–2 observations: not enough to trust. 3–7: a real pattern is emerging. 8+: solid. */
export function confidenceFor(count: number): Confidence {
  if (count < 3) return "low";
  if (count < 8) return "medium";
  return "high";
}

const STYLES: Record<Confidence, string> = {
  low: "border-warning/30 bg-warning-soft text-warning-foreground",
  medium: "border-surface-border bg-surface-border/40 text-muted",
  high: "border-success/30 bg-success-soft text-success-foreground",
};

const LABELS: Record<Confidence, string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

export function ConfidenceBadge({ count }: { count: number }) {
  const level = confidenceFor(count);
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${STYLES[level]}`}
    >
      {LABELS[level]}
    </span>
  );
}
