import { and, asc, eq, isNotNull, isNull, like, or } from "drizzle-orm";
import { db } from "@/db/client";
import { marks, type MarkRow } from "@/db/schema";
import type { MarkInput, MarkFilterInput } from "@/lib/validation/mark";

export async function listMarks(userId: number, filters: MarkFilterInput = {}): Promise<MarkRow[]> {
  const conditions = [eq(marks.userId, userId)];
  if (filters.location) conditions.push(like(marks.location, `%${filters.location}%`));
  if (filters.mark) conditions.push(like(marks.name, `%${filters.mark}%`));

  return db
    .select()
    .from(marks)
    .where(and(...conditions))
    .orderBy(asc(marks.location), asc(marks.name));
}

export async function getMarkById(userId: number, id: number): Promise<MarkRow | undefined> {
  const [mark] = await db
    .select()
    .from(marks)
    .where(and(eq(marks.id, id), eq(marks.userId, userId)));
  return mark;
}

export async function createMark(userId: number, input: MarkInput): Promise<number> {
  const [created] = await db
    .insert(marks)
    .values({ ...input, userId })
    .returning({ id: marks.id });
  return created.id;
}

export async function updateMark(userId: number, id: number, input: MarkInput): Promise<void> {
  await db
    .update(marks)
    .set(input)
    .where(and(eq(marks.id, id), eq(marks.userId, userId)));
}

export async function deleteMark(userId: number, id: number): Promise<void> {
  await db.delete(marks).where(and(eq(marks.id, id), eq(marks.userId, userId)));
}

/** Marks that have GPS coordinates but no location yet — candidates for reverse-geocoding. */
export async function listMarksMissingLocation(userId: number): Promise<MarkRow[]> {
  return db
    .select()
    .from(marks)
    .where(and(eq(marks.userId, userId), isNotNull(marks.lat), isNotNull(marks.lng), isNull(marks.location)));
}

/** Marks that have a location name but no GPS yet — candidates for forward-geocoding. */
export async function listMarksMissingGps(userId: number): Promise<MarkRow[]> {
  return db
    .select()
    .from(marks)
    .where(and(eq(marks.userId, userId), isNotNull(marks.location), or(isNull(marks.lat), isNull(marks.lng))));
}

export async function setMarkLocation(userId: number, id: number, location: string): Promise<void> {
  await db
    .update(marks)
    .set({ location })
    .where(and(eq(marks.id, id), eq(marks.userId, userId)));
}

export async function setMarkGps(userId: number, id: number, lat: number, lng: number): Promise<void> {
  await db
    .update(marks)
    .set({ lat, lng })
    .where(and(eq(marks.id, id), eq(marks.userId, userId)));
}
