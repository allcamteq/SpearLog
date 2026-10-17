import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { marks, users } from "@/db/schema";
import { getUserId } from "@/lib/auth-helpers";

type EnableItem = { id: number; gpsEncrypted: string };
type DisableItem = { id: number; lat: number | null; lng: number | null };

function validEncryptedMark(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 4096) return false;
  try {
    const parsed = JSON.parse(value);
    return parsed.version === 1 && typeof parsed.iv === "string" && typeof parsed.ciphertext === "string";
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.enabled !== "boolean" || !Array.isArray(body.marks)) {
    return NextResponse.json({ error: "Invalid private GPS request." }, { status: 400 });
  }

  try {
    await db.transaction(async (tx) => {
      const [user] = await tx.select({ enabled: users.privateGpsEnabled }).from(users).where(eq(users.id, userId));
      if (!user || user.enabled === body.enabled) throw new Error("Private GPS setting changed. Refresh and try again.");

      const ownedMarks = await tx.select().from(marks).where(eq(marks.userId, userId));
      if (body.enabled) {
        const items = body.marks as EnableItem[];
        const expectedIds = ownedMarks.filter((mark) => mark.lat != null || mark.lng != null).map((mark) => mark.id).sort((a, b) => a - b);
        if (
          items.some((item) => !Number.isInteger(item.id) || !validEncryptedMark(item.gpsEncrypted)) ||
          new Set(items.map((item) => item.id)).size !== items.length ||
          items.map((item) => item.id).sort((a, b) => a - b).some((id, index) => id !== expectedIds[index]) ||
          items.length !== expectedIds.length
        ) {
          throw new Error("Could not encrypt every mark. Nothing was changed.");
        }

        for (const item of items) {
          await tx
            .update(marks)
            .set({ lat: null, lng: null, gpsEncrypted: item.gpsEncrypted })
            .where(and(eq(marks.id, item.id), eq(marks.userId, userId)));
        }
      } else {
        const items = body.marks as DisableItem[];
        const expectedIds = ownedMarks.filter((mark) => mark.gpsEncrypted != null).map((mark) => mark.id).sort((a, b) => a - b);
        if (
          items.some(
            (item) =>
              !Number.isInteger(item.id) ||
              (item.lat !== null && (typeof item.lat !== "number" || item.lat < -90 || item.lat > 90)) ||
              (item.lng !== null && (typeof item.lng !== "number" || item.lng < -180 || item.lng > 180))
          ) ||
          new Set(items.map((item) => item.id)).size !== items.length ||
          items.map((item) => item.id).sort((a, b) => a - b).some((id, index) => id !== expectedIds[index]) ||
          items.length !== expectedIds.length
        ) {
          throw new Error("Could not decrypt every mark. Nothing was changed.");
        }

        for (const item of items) {
          await tx
            .update(marks)
            .set({ lat: item.lat, lng: item.lng, gpsEncrypted: null })
            .where(and(eq(marks.id, item.id), eq(marks.userId, userId)));
        }
      }

      await tx.update(users).set({ privateGpsEnabled: body.enabled }).where(eq(users.id, userId));
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update Private GPS." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}