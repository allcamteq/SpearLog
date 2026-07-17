"use client";

import { useState } from "react";
import { MarksMap } from "@/components/marks-map";
import type { MappableMark } from "@/components/marks-map-inner";

export function MarksMapSection({ marks, focusMarkId }: { marks: MappableMark[]; focusMarkId?: number | null }) {
  const [showLabels, setShowLabels] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <label className="flex w-fit items-center gap-2 rounded-md bg-surface/80 px-2 py-1 text-sm text-muted backdrop-blur-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-surface-border text-accent focus:ring-accent"
          checked={showLabels}
          onChange={(e) => setShowLabels(e.target.checked)}
        />
        Display mark name
      </label>
      <MarksMap marks={marks} showLabels={showLabels} focusMarkId={focusMarkId} />
    </div>
  );
}
