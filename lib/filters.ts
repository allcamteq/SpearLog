import type { SessionFilterInput } from "@/lib/validation/session";
import { sessionFilterSchema } from "@/lib/validation/session";
import type { MarkFilterInput } from "@/lib/validation/mark";
import { markFilterSchema } from "@/lib/validation/mark";

export function parseSessionFilters(searchParams: URLSearchParams): SessionFilterInput {
  const raw = {
    location: searchParams.get("location") ?? undefined,
    country: searchParams.get("country") ?? undefined,
    minRating: searchParams.get("minRating") ?? undefined,
    maxRating: searchParams.get("maxRating") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    species: searchParams.get("species") ?? undefined,
    mark: searchParams.get("mark") ?? undefined,
    tideType: searchParams.get("tideType") ?? undefined,
    hasComments: searchParams.get("hasComments") ?? undefined,
    hasMarks: searchParams.get("hasMarks") ?? undefined,
    hasFish: searchParams.get("hasFish") ?? undefined,
  };

  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined && v !== ""));

  const result = sessionFilterSchema.safeParse(cleaned);
  return result.success ? result.data : {};
}

export function parseMarkFilters(searchParams: URLSearchParams): MarkFilterInput {
  const raw = {
    location: searchParams.get("location") ?? undefined,
    mark: searchParams.get("mark") ?? undefined,
  };

  const cleaned = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined && v !== ""));

  const result = markFilterSchema.safeParse(cleaned);
  return result.success ? result.data : {};
}
