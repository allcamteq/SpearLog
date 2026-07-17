"use client";

import { button } from "@/lib/ui";

export function MarkExportButton() {
  const href = `/api/marks/export`;

  return (
    <a href={href} className={button("primary")}>
      Export GPX
    </a>
  );
}
