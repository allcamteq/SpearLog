import type { FishConditionStat } from "@/db/queries/stats";
import { BreakdownCell } from "@/components/insights2/breakdown-cell";
import { TIDE_TYPE_LABELS } from "@/lib/constants";

const tideTypeLabel = (v: string) => TIDE_TYPE_LABELS[v as keyof typeof TIDE_TYPE_LABELS] ?? v;

export function FishConditionsTable({ data }: { data: FishConditionStat[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted">No catches logged yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-surface-border text-left text-sm text-foreground">
          <th className="py-1 pr-4 font-semibold">Species</th>
          <th className="py-1 pr-4 font-semibold">Top mark</th>
          <th className="py-1 pr-4 font-semibold">Most common tide type</th>
          <th className="py-1 pr-4 font-semibold">Most common current</th>
          <th className="py-1 pr-4 font-semibold">Most common sea condition</th>
          <th className="py-1 pr-4 font-semibold">Most common wind condition</th>
          <th className="py-1 pr-4 font-semibold">Most common time of day</th>
        </tr>
      </thead>
      <tbody>
        {data.map((stat) => (
          <tr key={stat.species} className="border-b border-surface-border/60 align-top last:border-0">
            <td className="py-2 pr-4 font-medium">{stat.species}</td>
            <td className="py-2 pr-4">
              <BreakdownCell top={stat.topMark} breakdown={stat.markBreakdown} />
            </td>
            <td className="py-2 pr-4">
              <BreakdownCell top={stat.topTideType} breakdown={stat.tideTypeBreakdown} labelFor={tideTypeLabel} />
            </td>
            <td className="py-2 pr-4">
              <BreakdownCell top={stat.topCurrent} breakdown={stat.currentBreakdown} />
            </td>
            <td className="py-2 pr-4">
              <BreakdownCell top={stat.topSeaCondition} breakdown={stat.seaConditionBreakdown} />
            </td>
            <td className="py-2 pr-4">
              <BreakdownCell top={stat.topWindCondition} breakdown={stat.windConditionBreakdown} />
            </td>
            <td className="py-2 pr-4">
              <BreakdownCell top={stat.topTimeOfDay} breakdown={stat.timeOfDayBreakdown} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
