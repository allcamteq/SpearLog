"use client";

import { button } from "@/lib/ui";
import { buildGpx, type GpxMark } from "@/lib/gpx";

export function MarkExportButton({ marks }: { marks?: GpxMark[] }) {
  const href = `/api/marks/export`;

  if (marks) {
    return (
      <button
        type="button"
        onClick={() => {
          const url = URL.createObjectURL(new Blob([buildGpx(marks)], { type: "application/gpx+xml" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = "marks.gpx";
          link.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
        className={button("primary")}
      >
        Export GPX
      </button>
    );
  }

  return (
    <a href={href} className={button("primary")}>
      Export GPX
    </a>
  );
}
