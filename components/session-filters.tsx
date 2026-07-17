"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { TIDE_TYPES, TIDE_TYPE_LABELS } from "@/lib/constants";
import { inputClass, labelClass, cardClass, button } from "@/lib/ui";

type FilterField =
  | "location"
  | "country"
  | "minRating"
  | "maxRating"
  | "dateFrom"
  | "dateTo"
  | "species"
  | "mark"
  | "tideType"
  | "hasComments"
  | "hasMarks"
  | "hasFish";

const ALL_FIELDS: FilterField[] = [
  "location",
  "country",
  "minRating",
  "maxRating",
  "dateFrom",
  "dateTo",
  "mark",
  "tideType",
  "hasComments",
  "hasMarks",
  "hasFish",
];

// Shown in the always-visible compact bar; everything else in `fields` lives
// behind the "Advanced filters" toggle.
const QUICK_FIELDS: FilterField[] = ["location", "mark", "dateFrom", "dateTo", "minRating"];

const FIELD_LABELS: Record<FilterField, string> = {
  location: "Location",
  country: "Country",
  minRating: "Min rating",
  maxRating: "Max rating",
  dateFrom: "Date from",
  dateTo: "Date to",
  species: "Species",
  mark: "Mark",
  tideType: "Tide type",
  hasComments: "Has comments",
  hasMarks: "Has marks",
  hasFish: "Has catches",
};

function formatChipLabel(field: FilterField, value: string): string {
  if (field === "hasComments" || field === "hasMarks" || field === "hasFish") return FIELD_LABELS[field];
  if (field === "minRating") return `Min rating: ${value}+`;
  if (field === "tideType") return TIDE_TYPE_LABELS[value as keyof typeof TIDE_TYPE_LABELS] ?? value;
  return `${FIELD_LABELS[field]}: ${value}`;
}

export function SessionFilters({
  locationOptions,
  countryOptions,
  speciesOptions = [],
  markOptions = [],
  fields = ALL_FIELDS,
  basePath = "/",
}: {
  locationOptions: string[];
  countryOptions: string[];
  speciesOptions?: string[];
  markOptions?: string[];
  fields?: FilterField[];
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const field of fields) {
      initial[field] = searchParams.get(field) ?? "";
    }
    return initial;
  });

  function update(field: string, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function push(next: Record<string, string>) {
    const params = new URLSearchParams();
    for (const field of fields) {
      if (next[field]) params.set(field, next[field]);
    }
    router.push(`${basePath}?${params.toString()}`);
  }

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    push(values);
  }

  function clearFilters() {
    const cleared = Object.fromEntries(fields.map((f) => [f, ""]));
    setValues(cleared);
    router.push(basePath);
  }

  function removeFilter(field: string) {
    const next = { ...values, [field]: "" };
    setValues(next);
    push(next);
  }

  function renderField(field: FilterField) {
    switch (field) {
      case "location":
        return (
          <div key={field}>
            <label className={labelClass}>Location</label>
            <select className={inputClass} value={values.location} onChange={(e) => update("location", e.target.value)}>
              <option value="">Any</option>
              {locationOptions.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        );
      case "country":
        return (
          <div key={field}>
            <label className={labelClass}>Country</label>
            <select className={inputClass} value={values.country} onChange={(e) => update("country", e.target.value)}>
              <option value="">Any</option>
              {countryOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        );
      case "minRating":
        return (
          <div key={field}>
            <label className={labelClass}>Min rating</label>
            <select className={inputClass} value={values.minRating} onChange={(e) => update("minRating", e.target.value)}>
              <option value="">Any</option>
              {[1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>
                  {r}+
                </option>
              ))}
            </select>
          </div>
        );
      case "maxRating":
        return (
          <div key={field}>
            <label className={labelClass}>Max rating</label>
            <select className={inputClass} value={values.maxRating} onChange={(e) => update("maxRating", e.target.value)}>
              <option value="">Any</option>
              {[1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        );
      case "dateFrom":
        return (
          <div key={field} className="col-span-2 sm:col-auto">
            <label className={labelClass}>Date from</label>
            <input
              type="date"
              className={inputClass}
              value={values.dateFrom}
              onChange={(e) => update("dateFrom", e.target.value)}
            />
          </div>
        );
      case "dateTo":
        return (
          <div key={field} className="col-span-2 sm:col-auto">
            <label className={labelClass}>Date to</label>
            <input
              type="date"
              className={inputClass}
              value={values.dateTo}
              onChange={(e) => update("dateTo", e.target.value)}
            />
          </div>
        );
      case "species":
        return (
          <div key={field}>
            <label className={labelClass}>Species</label>
            <select className={inputClass} value={values.species} onChange={(e) => update("species", e.target.value)}>
              <option value="">Any</option>
              {speciesOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        );
      case "mark":
        return (
          <div key={field}>
            <label className={labelClass}>Mark</label>
            <select className={inputClass} value={values.mark} onChange={(e) => update("mark", e.target.value)}>
              <option value="">Any</option>
              {markOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        );
      case "tideType":
        return (
          <div key={field}>
            <label className={labelClass}>Tide type</label>
            <select className={inputClass} value={values.tideType} onChange={(e) => update("tideType", e.target.value)}>
              <option value="">Any</option>
              {TIDE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TIDE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        );
      case "hasComments":
        return (
          <div key={field}>
            <label className={labelClass}>Has comments</label>
            <div className="flex h-[38px] items-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-surface-border text-accent focus:ring-accent"
                checked={values.hasComments === "true"}
                onChange={(e) => update("hasComments", e.target.checked ? "true" : "")}
              />
            </div>
          </div>
        );
      case "hasMarks":
        return (
          <div key={field}>
            <label className={labelClass}>Has marks</label>
            <div className="flex h-[38px] items-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-surface-border text-accent focus:ring-accent"
                checked={values.hasMarks === "true"}
                onChange={(e) => update("hasMarks", e.target.checked ? "true" : "")}
              />
            </div>
          </div>
        );
      case "hasFish":
        return (
          <div key={field}>
            <label className={labelClass}>Has catches</label>
            <div className="flex h-[38px] items-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-surface-border text-accent focus:ring-accent"
                checked={values.hasFish === "true"}
                onChange={(e) => update("hasFish", e.target.checked ? "true" : "")}
              />
            </div>
          </div>
        );
    }
  }

  const quickFields = fields.filter((f) => QUICK_FIELDS.includes(f));
  const advancedFields = fields.filter((f) => !QUICK_FIELDS.includes(f));
  const activeChips = fields.filter((f) => values[f]).map((f) => ({ field: f, label: formatChipLabel(f, values[f]) }));

  return (
    <div className={`${cardClass} p-4`}>
      {activeChips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {activeChips.map(({ field, label }) => (
            <button
              key={field}
              type="button"
              onClick={() => removeFilter(field)}
              className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-soft-foreground hover:bg-accent-soft/70"
            >
              {label}
              <span aria-hidden>×</span>
            </button>
          ))}
          <button type="button" onClick={clearFilters} className="text-xs text-muted hover:text-foreground">
            Clear all
          </button>
        </div>
      )}

      <form onSubmit={applyFilters} className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="grid grid-cols-2 gap-3 sm:contents">{quickFields.map(renderField)}</div>
          <div className="flex gap-2">
            <button type="submit" className={button("primary", "text-xs")}>
              Apply
            </button>
            {advancedFields.length > 0 && (
              <button type="button" onClick={() => setShowAdvanced((v) => !v)} className={button("ghost", "text-xs")}>
                {showAdvanced ? "Hide advanced" : "Advanced filters"}
              </button>
            )}
          </div>
        </div>

        {showAdvanced && advancedFields.length > 0 && (
          <div className="grid grid-cols-1 gap-3 border-t border-surface-border pt-3 sm:grid-cols-4">
            {advancedFields.map(renderField)}
          </div>
        )}
      </form>
    </div>
  );
}
