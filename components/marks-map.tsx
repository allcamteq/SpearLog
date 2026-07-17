"use client";

import dynamic from "next/dynamic";
import type { MappableMark } from "@/components/marks-map-inner";

const MarksMapInner = dynamic(() => import("@/components/marks-map-inner").then((m) => m.MarksMapInner), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center rounded-xl border border-surface-border bg-surface text-sm text-muted sm:h-[32rem]">
      Loading map…
    </div>
  ),
});

export function MarksMap({
  marks,
  showLabels,
  focusMarkId,
}: {
  marks: MappableMark[];
  showLabels?: boolean;
  focusMarkId?: number | null;
}) {
  return <MarksMapInner marks={marks} showLabels={showLabels} focusMarkId={focusMarkId} />;
}
