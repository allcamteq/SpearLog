import { NextRequest, NextResponse } from "next/server";
import { listMarks, createMark } from "@/db/queries/marks";
import { markSchema, markFilterSchema } from "@/lib/validation/mark";
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

export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rawFilters = {
    location: request.nextUrl.searchParams.get("location") ?? undefined,
    locationDetails: request.nextUrl.searchParams.get("locationDetails") ?? undefined,
  };
  const filters = markFilterSchema.parse(rawFilters);

  const results = await listMarks(userId, filters);
  return NextResponse.json(results);
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  try {
    const id = await createMark(userId, parsed.data);
    return NextResponse.json({ id, ...parsed.data }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.message.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ error: `A mark named "${parsed.data.name}" already exists.` }, { status: 409 });
    }
    throw err;
  }
}
