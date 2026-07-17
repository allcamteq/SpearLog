import { redirect } from "next/navigation";
import { listSessions } from "@/db/queries/sessions";
import { listAllOptionValues } from "@/db/queries/options";
import { listMarks } from "@/db/queries/marks";
import { parseSessionFilters } from "@/lib/filters";
import { getUserId } from "@/lib/auth-helpers";
import { SessionFilters } from "@/components/session-filters";
import { SessionTable } from "@/components/session-table";
import { SessionDataActionsMenu } from "@/components/session-data-actions-menu";
import { FetchMissingConditionsButton } from "@/components/fetch-missing-conditions-button";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const rawParams = await searchParams;
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string") usp.set(key, value);
  }

  const filters = parseSessionFilters(usp);
  const [sessions, options, marks] = await Promise.all([
    listSessions(userId, filters),
    listAllOptionValues(userId),
    listMarks(userId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Logbook</h1>
        <div className="flex flex-wrap items-center gap-2">
          <FetchMissingConditionsButton />
          <SessionDataActionsMenu />
        </div>
      </div>
      <SessionFilters
        locationOptions={options.location}
        countryOptions={options.country}
        markOptions={marks.map((m) => m.name)}
      />
      <SessionTable sessions={sessions} />
    </div>
  );
}
