import { redirect } from "next/navigation";
import { listMarks } from "@/db/queries/marks";
import { listOptions } from "@/db/queries/options";
import { parseMarkFilters } from "@/lib/filters";
import { getUserId } from "@/lib/auth-helpers";
import { getUserById } from "@/db/queries/users";
import { MarkFilters } from "@/components/mark-filters";
import { PrivateGpsMarksWorkspace } from "@/components/private-gps-marks-workspace";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function MarksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const userId = await getUserId();
  if (!userId) redirect("/login");

  const rawParams = await searchParams;
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string") usp.set(key, value);
  }

  const filters = parseMarkFilters(usp);
  const [marks, allMarks, locationOptions, locationDetailsOptions, user] = await Promise.all([
    listMarks(userId, filters),
    listMarks(userId),
    listOptions(userId, "location"),
    listOptions(userId, "locationDetails"),
    getUserById(userId),
  ]);
  const focusMarkName = typeof rawParams.focus === "string" ? rawParams.focus : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Marks</h1>
      </div>

      <MarkFilters
        locationOptions={locationOptions.map((o) => o.value)}
        markOptions={allMarks.map((m) => m.name)}
      />

      <PrivateGpsMarksWorkspace
        marks={marks}
        allMarks={allMarks}
        locationOptions={locationOptions.map((o) => o.value)}
        locationDetailsOptions={locationDetailsOptions.map((o) => o.value)}
        privateGpsEnabled={user?.privateGpsEnabled ?? false}
        focusMarkName={focusMarkName}
      />
    </div>
  );
}
