import { NextRequest, NextResponse } from "next/server";
import { deleteOption } from "@/db/queries/options";
import { getUserId } from "@/lib/auth-helpers";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deleteOption(userId, Number(id));
  return NextResponse.json({ ok: true });
}
