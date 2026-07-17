import { and, eq, gte, lte, like, sql, desc, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, catches, sessionPhotos, sessionMarks, marks, type SessionRow, type CatchRow } from "@/db/schema";
import type { SessionInput, CatchInput, SessionMarkInput, SessionFilterInput } from "@/lib/validation/session";
import { ensureOption, type Tx } from "@/db/queries/options";

async function registerSessionOptions(tx: Tx, userId: number, input: SessionInput, catchInputs: CatchInput[]) {
  await ensureOption(tx, userId, "location", input.location);
  await ensureOption(tx, userId, "locationDetails", input.locationDetails);
  await ensureOption(tx, userId, "country", input.country);
  for (const c of catchInputs) {
    await ensureOption(tx, userId, "species", c.species);
  }
}

export type SessionMark = { id: number; name: string; lat: number | null; lng: number | null };
export type CatchWithMark = CatchRow & { markName: string | null };
export type SessionWithCatches = SessionRow & { catches: CatchWithMark[]; marks: SessionMark[] };

const catchColumns = {
  id: catches.id,
  sessionId: catches.sessionId,
  species: catches.species,
  quantity: catches.quantity,
  weight: catches.weight,
  size: catches.size,
  markId: catches.markId,
  markName: marks.name,
};

export function buildFilters(userId: number, filters: SessionFilterInput) {
  const conditions = [eq(sessions.userId, userId)];

  if (filters.location) {
    conditions.push(like(sessions.location, `%${filters.location}%`));
  }
  if (filters.country) {
    conditions.push(like(sessions.country, `%${filters.country}%`));
  }
  if (filters.minRating !== undefined) {
    conditions.push(gte(sessions.rating, filters.minRating));
  }
  if (filters.maxRating !== undefined) {
    conditions.push(lte(sessions.rating, filters.maxRating));
  }
  if (filters.dateFrom) {
    conditions.push(gte(sessions.date, filters.dateFrom));
  }
  if (filters.dateTo) {
    conditions.push(lte(sessions.date, filters.dateTo));
  }
  if (filters.tideType) {
    conditions.push(eq(sessions.tideType, filters.tideType));
  }
  if (filters.species) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${catches} WHERE ${catches.sessionId} = ${sessions.id} AND ${catches.species} LIKE ${`%${filters.species}%`})`
    );
  }
  if (filters.mark) {
    conditions.push(
      sql`(
        EXISTS (
          SELECT 1 FROM ${sessionMarks} JOIN ${marks} ON ${sessionMarks.markId} = ${marks.id}
          WHERE ${sessionMarks.sessionId} = ${sessions.id} AND ${marks.name} LIKE ${`%${filters.mark}%`}
        )
        OR EXISTS (
          SELECT 1 FROM ${catches} JOIN ${marks} ON ${catches.markId} = ${marks.id}
          WHERE ${catches.sessionId} = ${sessions.id} AND ${marks.name} LIKE ${`%${filters.mark}%`}
        )
      )`
    );
  }
  if (filters.hasComments === "true") {
    conditions.push(sql`${sessions.comments} IS NOT NULL AND TRIM(${sessions.comments}) != ''`);
  }
  if (filters.hasFish === "true") {
    conditions.push(sql`EXISTS (SELECT 1 FROM ${catches} WHERE ${catches.sessionId} = ${sessions.id})`);
  }
  if (filters.hasMarks === "true") {
    conditions.push(
      sql`(
        EXISTS (SELECT 1 FROM ${sessionMarks} WHERE ${sessionMarks.sessionId} = ${sessions.id})
        OR EXISTS (SELECT 1 FROM ${catches} WHERE ${catches.sessionId} = ${sessions.id} AND ${catches.markId} IS NOT NULL)
      )`
    );
  }

  return and(...conditions);
}

async function loadMarksBySession(sessionIds: number[]): Promise<Map<number, SessionMark[]>> {
  const marksBySession = new Map<number, SessionMark[]>();
  if (sessionIds.length === 0) return marksBySession;

  const rows = await db
    .select({
      sessionId: sessionMarks.sessionId,
      id: marks.id,
      name: marks.name,
      lat: marks.lat,
      lng: marks.lng,
    })
    .from(sessionMarks)
    .innerJoin(marks, eq(sessionMarks.markId, marks.id))
    .where(inArray(sessionMarks.sessionId, sessionIds));

  for (const row of rows) {
    const list = marksBySession.get(row.sessionId) ?? [];
    list.push({ id: row.id, name: row.name, lat: row.lat, lng: row.lng });
    marksBySession.set(row.sessionId, list);
  }
  return marksBySession;
}

export async function listSessions(
  userId: number,
  filters: SessionFilterInput = {}
): Promise<SessionWithCatches[]> {
  const matched = await db
    .select()
    .from(sessions)
    .where(buildFilters(userId, filters))
    .orderBy(desc(sessions.date), desc(sessions.id));

  if (matched.length === 0) return [];

  const ids = matched.map((s) => s.id);
  const [relatedCatches, marksBySession] = await Promise.all([
    db.select(catchColumns).from(catches).leftJoin(marks, eq(catches.markId, marks.id)).where(inArray(catches.sessionId, ids)),
    loadMarksBySession(ids),
  ]);

  const catchesBySession = new Map<number, CatchWithMark[]>();
  for (const c of relatedCatches) {
    const list = catchesBySession.get(c.sessionId) ?? [];
    list.push(c);
    catchesBySession.set(c.sessionId, list);
  }

  return matched.map((session) => ({
    ...session,
    catches: catchesBySession.get(session.id) ?? [],
    marks: marksBySession.get(session.id) ?? [],
  }));
}

export async function getSessionById(userId: number, id: number): Promise<SessionWithCatches | undefined> {
  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.userId, userId)));
  if (!session) return undefined;

  const [sessionCatches, marksBySession] = await Promise.all([
    db.select(catchColumns).from(catches).leftJoin(marks, eq(catches.markId, marks.id)).where(eq(catches.sessionId, id)),
    loadMarksBySession([id]),
  ]);
  return { ...session, catches: sessionCatches, marks: marksBySession.get(id) ?? [] };
}

export async function createSession(
  userId: number,
  input: SessionInput,
  catchInputs: CatchInput[],
  markInputs: SessionMarkInput[]
): Promise<number> {
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(sessions)
      .values({ ...input, userId })
      .returning({ id: sessions.id });
    if (catchInputs.length > 0) {
      await tx.insert(catches).values(catchInputs.map((c) => ({ ...c, sessionId: created.id })));
    }
    if (markInputs.length > 0) {
      await tx.insert(sessionMarks).values(markInputs.map((m) => ({ markId: m.markId, sessionId: created.id })));
    }
    await registerSessionOptions(tx, userId, input, catchInputs);
    return created.id;
  });
}

export async function updateSession(
  userId: number,
  id: number,
  input: SessionInput,
  catchInputs: CatchInput[],
  markInputs: SessionMarkInput[]
): Promise<void> {
  await db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId)));
    if (!owned) return;

    await tx
      .update(sessions)
      .set({ ...input, updatedAt: sql`(current_timestamp)` })
      .where(eq(sessions.id, id));

    await tx.delete(catches).where(eq(catches.sessionId, id));
    if (catchInputs.length > 0) {
      await tx.insert(catches).values(catchInputs.map((c) => ({ ...c, sessionId: id })));
    }

    await tx.delete(sessionMarks).where(eq(sessionMarks.sessionId, id));
    if (markInputs.length > 0) {
      await tx.insert(sessionMarks).values(markInputs.map((m) => ({ markId: m.markId, sessionId: id })));
    }

    await registerSessionOptions(tx, userId, input, catchInputs);
  });
}

/** Sessions with a location and date (required to query Stormglass) but no tide/current data fetched yet — candidates for bulk-fetching. */
export async function listSessionsMissingConditions(userId: number): Promise<SessionRow[]> {
  return db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        sql`${sessions.location} IS NOT NULL AND TRIM(${sessions.location}) != ''`,
        sql`${sessions.date} IS NOT NULL AND TRIM(${sessions.date}) != ''`,
        // Time-input fields land as "" (not NULL) when a session is saved without ever
        // fetching conditions, so treat both NULL and blank as "missing" here.
        sql`(${sessions.highTideTime} IS NULL OR TRIM(${sessions.highTideTime}) = '')`,
        sql`(${sessions.current} IS NULL OR TRIM(${sessions.current}) = '')`
      )
    )
    .orderBy(desc(sessions.date), desc(sessions.id));
}

/** Writes back Stormglass-derived fields for a single session without touching its catches/marks, so a bulk background job can't clobber unrelated edits. */
export async function setSessionConditions(
  userId: number,
  id: number,
  fields: {
    gpsPoint: string | null;
    highTideTime: string | null;
    lowTideTime: string | null;
    slackTideTime: string | null;
    tideRatio: number | null;
    tideType: SessionRow["tideType"];
    current: SessionRow["current"];
    currentSpeedKt: number | null;
    seaCondition: SessionRow["seaCondition"];
    windCondition: SessionRow["windCondition"];
    windDirection: number | null;
    pressure: number | null;
  }
): Promise<void> {
  await db
    .update(sessions)
    .set({ ...fields, updatedAt: sql`(current_timestamp)` })
    .where(and(eq(sessions.id, id), eq(sessions.userId, userId)));
}

/** Deletes the session and returns the blob storage pathnames of any photos that were attached, so the caller can remove the actual files from Blob storage (a network call, so it can't happen inside this DB transaction). */
export async function deleteSession(userId: number, id: number): Promise<string[]> {
  return db.transaction(async (tx) => {
    const [owned] = await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.userId, userId)));
    if (!owned) return [];

    const photos = await tx
      .select({ pathname: sessionPhotos.pathname })
      .from(sessionPhotos)
      .where(eq(sessionPhotos.sessionId, id));

    await tx.delete(sessionPhotos).where(eq(sessionPhotos.sessionId, id));
    await tx.delete(catches).where(eq(catches.sessionId, id));
    await tx.delete(sessionMarks).where(eq(sessionMarks.sessionId, id));
    await tx.delete(sessions).where(eq(sessions.id, id));

    return photos.map((p) => p.pathname);
  });
}
