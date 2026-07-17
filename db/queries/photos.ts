import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, sessionPhotos, type SessionPhotoRow } from "@/db/schema";

export async function assertSessionOwnership(userId: number, sessionId: number): Promise<boolean> {
  const [owned] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
  return !!owned;
}

export async function listPhotos(userId: number, sessionId: number): Promise<SessionPhotoRow[]> {
  if (!(await assertSessionOwnership(userId, sessionId))) return [];
  return db.select().from(sessionPhotos).where(eq(sessionPhotos.sessionId, sessionId));
}

export async function addPhoto(
  userId: number,
  sessionId: number,
  photo: { url: string; pathname: string }
): Promise<SessionPhotoRow | null> {
  if (!(await assertSessionOwnership(userId, sessionId))) return null;
  const [created] = await db
    .insert(sessionPhotos)
    .values({ sessionId, url: photo.url, pathname: photo.pathname })
    .returning();
  return created;
}

export async function getPhoto(userId: number, sessionId: number, photoId: number): Promise<SessionPhotoRow | null> {
  if (!(await assertSessionOwnership(userId, sessionId))) return null;
  const [photo] = await db
    .select()
    .from(sessionPhotos)
    .where(and(eq(sessionPhotos.id, photoId), eq(sessionPhotos.sessionId, sessionId)));
  return photo ?? null;
}

export async function deletePhoto(userId: number, sessionId: number, photoId: number): Promise<boolean> {
  if (!(await assertSessionOwnership(userId, sessionId))) return false;
  await db.delete(sessionPhotos).where(and(eq(sessionPhotos.id, photoId), eq(sessionPhotos.sessionId, sessionId)));
  return true;
}
