import { NextRequest, NextResponse } from "next/server";
import { getMarkById, updateMark, deleteMark } from "@/db/queries/marks";
import { markSchema } from "@/lib/validation/mark";
import { getUserId } from "@/lib/auth-helpers";
import { getUserById } from "@/db/queries/users";

function isEncryptedGps(value: string | null | undefined): boolean {
  if (value == null) return true;
  try {
    const payload = JSON.parse(value);
    return payload.version === 1 && typeof payload.iv === "string" && typeof payload.ciphertext === "string";
  } catch {
    return false;
  }
}

type RouteParams = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = markSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await getUserById(userId);
  if (user?.privateGpsEnabled) {
    if (parsed.data.lat != null || parsed.data.lng != null || !isEncryptedGps(parsed.data.gpsEncrypted)) {
      return NextResponse.json({ error: "Private GPS marks must be sent as encrypted coordinates." }, { status: 400 });
    }
  } else if (parsed.data.gpsEncrypted != null) {
    return NextResponse.json({ error: "Enable Private GPS before sending encrypted coordinates." }, { status: 400 });
  }

  const existing = await getMarkById(userId, Number(id));
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await updateMark(userId, Number(id), parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ error: `A mark named "${parsed.data.name}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deleteMark(userId, Number(id));
  return NextResponse.json({ ok: true });
}
