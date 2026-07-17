import type { MarkConditionStat } from "@/db/queries/stats";
import { BreakdownCell } from "@/components/breakdown-cell";
import { TIDE_TYPE_LABELS } from "@/lib/constants";

const tideTypeLabel = (v: string) => TIDE_TYPE_LABELS[v as keyof typeof TIDE_TYPE_LABELS] ?? v;

export function MarkConditionsTable({ data }: { data: MarkConditionStat[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted">No catches linked to a mark yet.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-surface-border text-left text-sm text-foreground">
          <th className="py-1 pr-4 font-semibold">Mark</th>
          <th className="py-1 pr-4 font-semibold">Catches</th>
          <th className="py-1 pr-4 font-semibold">Most common fish</th>
          <th className="py-1 pr-4 font-semibold">Most common tide type</th>
          <th className="py-1 pr-4 font-semibold">Most common current</th>
          <th className="py-1 pr-4 font-semibold">Most common sea condition</th>
          <th className="py-1 pr-4 font-semibold">Most common wind condition</th>
          <th className="py-1 pr-4 font-semibold">Most common time of day</th>
        </tr>
      </thead>
      <tbody>
        {data.map((stat) => (
          <tr key={stat.markName} className="border-b border-surface-border/60 align-top last:border-0">
            <td className="py-2 pr-4 font-medium">{stat.markName}</td>
            <td className="py-2 pr-4">{stat.catchCount}</td>
            <td className="py-2 pr-4">
              <BreakdownCell top={stat.topSpecies} breakdown={stat.speciesBreakdown} unit="fish" />
            </td>
            <td className="py-2 pr-4">
              <BreakdownCell top={stat.topTideType} breakdown={stat.tideTypeBreakdown} labelFor={tideTypeLabel} unit="catches" />
            </td>
            <td className="py-2 pr-4">
              <BreakdownCell top={stat.topCurrent} breakdown={stat.currentBreakdown} unit="catches" />
            </td>
            <td className="py-2 pr-4">
              <BreakdownCell top={stat.topSeaCondition} breakdown={stat.seaConditionBreakdown} unit="catches" />
            </td>
            <td className="py-2 pr-4">
              <BreakdownCell top={stat.topWindCondition} breakdown={stat.windConditionBreakdown} unit="catches" />
            </td>
            <td className="py-2 pr-4">
              <BreakdownCell top={stat.topTimeOfDay} breakdown={stat.timeOfDayBreakdown} unit="catches" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
