import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { optionValues, type OptionValueRow } from "@/db/schema";
import { OPTION_CATEGORIES, type OptionCategory } from "@/lib/constants";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function listOptions(userId: number, category: OptionCategory): Promise<OptionValueRow[]> {
  return db
    .select()
    .from(optionValues)
    .where(and(eq(optionValues.userId, userId), eq(optionValues.category, category)))
    .orderBy(asc(optionValues.value));
}

export async function addOption(userId: number, category: OptionCategory, value: string): Promise<void> {
  const trimmed = value.trim();
  if (!trimmed) return;
  await db.insert(optionValues).values({ userId, category, value: trimmed }).onConflictDoNothing();
}

export async function deleteOption(userId: number, id: number): Promise<void> {
  await db.delete(optionValues).where(and(eq(optionValues.id, id), eq(optionValues.userId, userId)));
}

export async function saveOptionLocation(
  userId: number,
  id: number,
  location: { lat: number; lng: number; resolvedAddress: string }
): Promise<void> {
  await db
    .update(optionValues)
    .set(location)
    .where(and(eq(optionValues.id, id), eq(optionValues.userId, userId)));
}

/** Looks up a saved geocode for a location option by its value, so tide/current lookups can reuse a verified result instead of re-querying Nominatim. */
export async function getSavedLocationGeocode(
  userId: number,
  value: string
): Promise<{ lat: number; lng: number } | null> {
  const [row] = await db
    .select({ lat: optionValues.lat, lng: optionValues.lng })
    .from(optionValues)
    .where(and(eq(optionValues.userId, userId), eq(optionValues.category, "location"), eq(optionValues.value, value)));

  return row?.lat != null && row?.lng != null ? { lat: row.lat, lng: row.lng } : null;
}

export async function listAllOptionValues(userId: number): Promise<Record<OptionCategory, string[]>> {
  const result = {} as Record<OptionCategory, string[]>;
  for (const category of OPTION_CATEGORIES) {
    result[category] = (await listOptions(userId, category)).map((r) => r.value);
  }
  return result;
}

/** Best-effort registration of a value into its dropdown vocabulary, used by session/catch creation so new values typed on the form or brought in via CSV import become available as options going forward. */
export async function ensureOption(
  tx: Tx,
  userId: number,
  category: OptionCategory,
  value: string | null | undefined
): Promise<void> {
  const trimmed = value?.trim();
  if (!trimmed) return;
  await tx.insert(optionValues).values({ userId, category, value: trimmed }).onConflictDoNothing();
}
