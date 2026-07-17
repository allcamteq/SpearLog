// Kept separate from tabs.tsx (which is "use client") so the Server Component
// page can import this plain constant directly — a value exported from a
// "use client" module isn't safely usable as a plain array on the server side.
export const INSIGHTS2_TABS = [
  { key: "overview", label: "Overview" },
  { key: "marks", label: "Marks" },
  { key: "locations", label: "Locations" },
  { key: "species", label: "Species" },
] as const;

export type Insights2TabKey = (typeof INSIGHTS2_TABS)[number]["key"];
