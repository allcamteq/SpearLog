import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { getUserId } from "@/lib/auth-helpers";
import { getPhoto, deletePhoto } from "@/db/queries/photos";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, photoId } = await params;
  const sessionId = Number(id);

  const photo = await getPhoto(userId, sessionId, Number(photoId));
  if (!photo) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await del(photo.pathname).catch(() => {
      // best-effort — if the blob is already gone, still remove our DB record
    });
  }

  await deletePhoto(userId, sessionId, Number(photoId));
  return NextResponse.json({ ok: true });
}
