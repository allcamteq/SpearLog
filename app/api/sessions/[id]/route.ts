import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { deleteSession, getSessionById, updateSession } from "@/db/queries/sessions";
import { sessionFormSchema } from "@/lib/validation/session";
import { getUserId } from "@/lib/auth-helpers";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const session = await getSessionById(userId, Number(id));

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const parsed = sessionFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await getSessionById(userId, Number(id));
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await updateSession(userId, Number(id), parsed.data.session, parsed.data.catches, parsed.data.marks);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const photoPathnames = await deleteSession(userId, Number(id));

  if (photoPathnames.length > 0 && process.env.BLOB_READ_WRITE_TOKEN) {
    await del(photoPathnames).catch(() => {
      // best-effort — the DB records are already gone either way
    });
  }

  return NextResponse.json({ ok: true });
}
