import { TIDE_TYPES, CURRENT_LEVELS, SEA_CONDITIONS, WIND_CONDITIONS, OPTION_CATEGORIES } from "@/db/schema";

export { TIDE_TYPES, CURRENT_LEVELS, SEA_CONDITIONS, WIND_CONDITIONS, OPTION_CATEGORIES };

export const RATING_OPTIONS = [1, 2, 3, 4, 5] as const;

export const TIDE_TYPE_LABELS: Record<(typeof TIDE_TYPES)[number], string> = {
  High: "High",
  "High to Low": "High to Low (Ebb)",
  Low: "Low",
  "Low to High": "Low to High (Flood)",
};

export const CURRENT_LEVEL_LABELS: Record<(typeof CURRENT_LEVELS)[number], string> = {
  Zero: "Zero (0 kt)",
  Low: "Low (0–0.5 kt)",
  Medium: "Medium (0.5–1 kt)",
  High: "High (1–2 kt)",
};

export const SEA_CONDITION_LABELS: Record<(typeof SEA_CONDITIONS)[number], string> = {
  Calm: "Calm (<0.5 m waves)",
  Rough: "Rough (0.5–1.5 m waves)",
  "Very Rough": "Very Rough (>1.5 m waves)",
};

export const WIND_CONDITION_LABELS: Record<(typeof WIND_CONDITIONS)[number], string> = {
  Calm: "Calm (<7 kt)",
  Moderate: "Moderate (7–16 kt)",
  Strong: "Strong (>16 kt)",
};

export type OptionCategory = (typeof OPTION_CATEGORIES)[number];

export const OPTION_CATEGORY_LABELS: Record<OptionCategory, string> = {
  location: "Location",
  locationDetails: "Location description",
  country: "Country",
  species: "Catch species",
};
