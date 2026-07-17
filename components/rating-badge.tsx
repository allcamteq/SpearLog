export function RatingBadge({ rating }: { rating: number | null }) {
  if (rating === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-surface-border/40 px-2 py-0.5 text-xs font-medium text-muted">
        Not rated
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
      {"★".repeat(rating)}
      {"☆".repeat(Math.max(0, 5 - rating))}
    </span>
  );
}
