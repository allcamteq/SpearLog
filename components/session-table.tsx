"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SessionWithCatches } from "@/db/queries/sessions";
import { RatingBadge } from "@/components/rating-badge";
import { parseFlexibleDate, formatDateDisplay } from "@/lib/date";
import { cardClass } from "@/lib/ui";

type SortKey = "date" | "location" | "locationDetails" | "fish" | "marks" | "rating";
type SortState = { key: SortKey; direction: 1 | -1 };

const DEFAULT_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "location", label: "Location" },
  { key: "locationDetails", label: "Location description" },
  { key: "fish", label: "Catches" },
  { key: "marks", label: "Marks" },
  { key: "rating", label: "Rating" },
];

const COMMENTS_COLUMNS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Date" },
  { key: "location", label: "Location" },
  { key: "locationDetails", label: "Location description" },
];

function getSortValue(session: SessionWithCatches, key: SortKey): string | number | null {
  switch (key) {
    case "date": {
      const parsed = parseFlexibleDate(session.date);
      return parsed ? parsed.getTime() : null;
    }
    case "location":
      return session.location;
    case "locationDetails":
      return session.locationDetails;
    case "fish":
      return session.catches.reduce((sum, c) => sum + c.quantity, 0);
    case "marks":
      return session.marks.length;
    case "rating":
      return session.rating;
  }
}

function compare(a: string | number | null, b: string | number | null, direction: 1 | -1): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls sort last regardless of direction
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * direction;
  return String(a).localeCompare(String(b)) * direction;
}

function catchSummary(session: SessionWithCatches): { total: number; species: string[] } {
  const total = session.catches.reduce((sum, c) => sum + c.quantity, 0);
  const species = [...new Set(session.catches.map((c) => c.species))];
  return { total, species };
}

export function SessionTable({ sessions }: { sessions: SessionWithCatches[] }) {
  const router = useRouter();
  const [sort, setSort] = useState<SortState>({ key: "date", direction: -1 });
  const [showComments, setShowComments] = useState(false);

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => compare(getSortValue(a, sort.key), getSortValue(b, sort.key), sort.direction)),
    [sessions, sort]
  );

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, direction: prev.direction === 1 ? -1 : 1 } : { key, direction: 1 }));
  }

  const columns = showComments ? COMMENTS_COLUMNS : DEFAULT_COLUMNS;

  if (sessions.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-surface-border p-8 text-center text-sm text-muted">
        No sessions match these filters yet.
      </p>
    );
  }

  return (
    <div className={`${cardClass} overflow-x-auto`}>
      <div className="flex items-center justify-end border-b border-surface-border px-3 py-2">
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-surface-border text-accent focus:ring-accent"
            checked={showComments}
            onChange={(e) => setShowComments(e.target.checked)}
          />
          Show comments column
        </label>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-border text-left text-xs text-muted">
            {columns.map((col) => {
              const active = sort.key === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sort.direction === 1 ? "ascending" : "descending") : "none"}
                  className="whitespace-nowrap px-4 py-2 font-normal"
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {col.label}
                    <span className="w-2.5 text-[10px]">{active ? (sort.direction === 1 ? "▲" : "▼") : ""}</span>
                  </button>
                </th>
              );
            })}
            {showComments && <th className="whitespace-nowrap px-4 py-2 font-normal">Comments</th>}
            {!showComments && <th className="whitespace-nowrap px-4 py-2 font-normal"></th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((session) => {
            const { total, species } = catchSummary(session);
            return (
              <tr
                key={session.id}
                tabIndex={0}
                onClick={() => router.push(`/sessions/${session.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") router.push(`/sessions/${session.id}`);
                }}
                className="group cursor-pointer border-b border-surface-border/60 last:border-0 hover:bg-accent-soft/30"
              >
                <td className="whitespace-nowrap px-4 py-2 text-muted">
                  {session.date ? formatDateDisplay(session.date) : "(no date)"}
                </td>
                <td className="whitespace-nowrap px-4 py-2 font-medium">
                  <Link href={`/sessions/${session.id}`} className="hover:underline">
                    {session.location || "(no location)"}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-muted">{session.locationDetails || "—"}</td>
                {showComments ? (
                  <td className="max-w-md px-4 py-2 text-muted">
                    {session.comments ? (
                      <span className="line-clamp-2 whitespace-pre-wrap">{session.comments}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-2">
                      {total === 0 ? (
                        "—"
                      ) : (
                        <>
                          {total}
                          {species.length > 0 && <span className="ml-1 text-xs text-muted">({species.join(", ")})</span>}
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2">{session.marks.length}</td>
                    <td className="px-4 py-2">
                      <RatingBadge rating={session.rating} />
                    </td>
                  </>
                )}
                <td className="px-4 py-2 text-right text-xs text-muted opacity-0 transition-opacity group-hover:opacity-100">
                  View →
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
