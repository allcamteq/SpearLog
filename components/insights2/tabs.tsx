"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { INSIGHTS2_TABS, type Insights2TabKey } from "@/components/insights2/tabs-config";

export function Insights2Tabs({ active }: { active: Insights2TabKey }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function hrefFor(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", key);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="flex flex-wrap gap-1 border-b border-surface-border">
      {INSIGHTS2_TABS.map((tab) => (
        <Link
          key={tab.key}
          href={hrefFor(tab.key)}
          className={
            active === tab.key
              ? "border-b-2 border-accent px-3 py-2 text-sm font-medium text-accent transition-colors"
              : "border-b-2 border-transparent px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
          }
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
