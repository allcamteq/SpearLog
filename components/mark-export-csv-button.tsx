"use client";

import { button } from "@/lib/ui";

export function MarkExportCsvButton() {
  const href = `/api/marks/export-csv`;

  return (
    <a href={href} className={button("primary")}>
      Export CSV
    </a>
  );
}
