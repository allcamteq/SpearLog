"use client";

import { useState } from "react";
import type { LocationPerformance } from "@/components/insights2/location-performance-cards";

type Mode = "total" | "perSession" | "successRate";

const MODES: { key: Mode; label: string }[] = [
  { key: "total", label: "Total catches" },
  { key: "perSession", label: "Catches per session" },
  { key: "successRate", label: "Successful sessions %" },
];

function valueFor(loc: LocationPerformance, mode: Mode): number {
  if (mode === "total") return loc.totalCatches;
  if (mode === "perSession") return loc.catchRate ?? 0;
  return loc.successRate ?? 0;
}

function formatValue(value: number, mode: Mode): string {
  if (mode === "total") return String(value);
  if (mode === "perSession") return value.toFixed(1);
  return `${value}%`;
}

/**
 * Raw catch totals favour locations visited more often — nine catches from ten visits can
 * be less productive than three from two. This toggle lets total catches, catches/session,
 * and successful-session % share one chart instead of three separate ones.
 */
export function LocationCatchesToggleChart({ data }: { data: LocationPerformance[] }) {
  const [mode, setMode] = useState<Mode>("total");

  if (data.length === 0) {
    return <p className="text-sm text-muted">No catches match this filter yet.</p>;
  }

  const sorted = [...data].sort((a, b) => valueFor(b, mode) - valueFor(a, mode));
  const max = Math.max(...sorted.map((loc) => valueFor(loc, mode)), 1);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={
              mode === m.key
                ? "rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground"
                : "rounded-full border border-surface-border px-3 py-1 text-xs text-muted hover:text-foreground"
            }
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {sorted.map((loc) => {
          const value = valueFor(loc, mode);
          const percent = (value / max) * 100;
          return (
            <div key={loc.location} className="flex items-center gap-3">
              <div className="w-28 shrink-0 truncate text-sm text-foreground">{loc.location}</div>
              <div className="relative h-4 flex-1 rounded bg-surface-border/30">
                <div className="h-4 rounded bg-accent" style={{ width: `${percent}%` }} />
              </div>
              <div className="w-14 shrink-0 text-right text-sm font-medium text-foreground">
                {formatValue(value, mode)}
              </div>
              <div className="w-20 shrink-0 text-xs text-muted">
                {loc.sessionCount} session{loc.sessionCount === 1 ? "" : "s"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
