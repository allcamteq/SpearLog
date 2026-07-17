import { redirect } from "next/navigation";
import { listMarks } from "@/db/queries/marks";
import { listOptions } from "@/db/queries/options";
import { parseMarkFilters } from "@/lib/filters";
import { getUserId } from "@/lib/auth-helpers";
import { MarkFilters } from "@/components/mark-filters";
import { MarksMapSection } from "@/components/marks-map-section";
import { MarkExportButton } from "@/components/mark-export-button";
import { MarkExportCsvButton } from "@/components/mark-export-csv-button";
import { MarkImportButton } from "@/components/mark-import-button";
import { PopulateMarkLocationsButton } from "@/components/populate-mark-locations-button";
import { MarksTable } from "@/components/marks-table";

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
  const [marks, allMarks, locationOptions, locationDetailsOptions] = await Promise.all([
    listMarks(userId, filters),
    listMarks(userId),
    listOptions(userId, "location"),
    listOptions(userId, "locationDetails"),
  ]);

  const mappable = marks
    .filter((m): m is typeof m & { lat: number; lng: number } => m.lat != null && m.lng != null)
    .map((m) => ({ id: m.id, name: m.name, location: m.location, lat: m.lat, lng: m.lng }));

  const focusParam = typeof rawParams.focus === "string" ? rawParams.focus : undefined;
  const focusMarkId = focusParam ? (mappable.find((m) => m.name === focusParam)?.id ?? null) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Marks</h1>
        <div className="flex flex-wrap gap-2">
          <MarkImportButton />
          <MarkExportButton />
          <MarkExportCsvButton />
        </div>
      </div>

      <MarkFilters
        locationOptions={locationOptions.map((o) => o.value)}
        markOptions={allMarks.map((m) => m.name)}
      />

      <MarksMapSection marks={mappable} focusMarkId={focusMarkId} />

      <div>
        <PopulateMarkLocationsButton />
      </div>

      <MarksTable
        marks={marks}
        locationOptions={locationOptions.map((o) => o.value)}
        locationDetailsOptions={locationDetailsOptions.map((o) => o.value)}
      />
    </div>
  );
}
