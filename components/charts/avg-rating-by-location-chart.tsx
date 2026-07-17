"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LocationStat } from "@/db/queries/stats";
import "./chart-theme.css";

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: LocationStat }[] }) {
  if (!active || !payload?.length) return null;
  const stat = payload[0].payload;
  return (
    <div className="rounded-md border border-surface-border bg-surface px-3 py-2 text-xs shadow-sm">
      <div className="font-medium">{stat.location}</div>
      <div className="text-muted">
        {stat.avgRating != null ? `Avg rating ${stat.avgRating.toFixed(1)} · ` : "No ratings yet · "}
        {stat.sessionCount} session{stat.sessionCount === 1 ? "" : "s"}
      </div>
    </div>
  );
}

export function AvgRatingByLocationChart({ data }: { data: LocationStat[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted">No sessions logged yet.</p>;
  }

  const height = Math.max(120, data.length * 36);

  return (
    <div className="viz-root">
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--gridline)" />
          <XAxis
            type="number"
            domain={[0, 5]}
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            axisLine={{ stroke: "var(--gridline)" }}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="location"
            width={110}
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            axisLine={{ stroke: "var(--gridline)" }}
            tickLine={false}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--gridline)", opacity: 0.4 }} />
          <Bar dataKey="avgRating" fill="var(--series-1)" barSize={20} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
