"use client";

import { button } from "@/lib/ui";
import type { MarkRow } from "@/db/schema";
import { buildCsv } from "@/lib/csv";

export function MarkExportCsvButton({ marks }: { marks?: MarkRow[] }) {
  const href = `/api/marks/export-csv`;

  if (marks) {
    return (
      <button
        type="button"
        onClick={() => {
          const rows = marks.map((mark) => ({
            name: mark.name,
            location: mark.location,
            location_details: mark.locationDetails,
            lat: mark.lat,
            lng: mark.lng,
            free_text: mark.freeText,
          }));
          const url = URL.createObjectURL(new Blob([buildCsv(rows, ["name", "location", "location_details", "lat", "lng", "free_text"])], { type: "text/csv" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = "marks.csv";
          link.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
        className={button("primary")}
      >
        Export CSV
      </button>
    );
  }

  return (
    <a href={href} className={button("primary")}>
      Export CSV
    </a>
  );
}
