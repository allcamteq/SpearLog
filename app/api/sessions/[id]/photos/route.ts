import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getUserId } from "@/lib/auth-helpers";
import { listPhotos, addPhoto, assertSessionOwnership } from "@/db/queries/photos";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const photos = await listPhotos(userId, Number(id));
  return NextResponse.json(photos);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Photo storage isn't configured yet (missing BLOB_READ_WRITE_TOKEN)." },
      { status: 500 }
    );
  }

  const { id } = await params;
  const sessionId = Number(id);

  if (!(await assertSessionOwnership(userId, sessionId))) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was uploaded" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG, WebP, or HEIC images are supported" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Image must be under 10MB" }, { status: 400 });
  }

  const pathname = `sessions/${sessionId}/${crypto.randomUUID()}-${file.name}`;
  const blob = await put(pathname, file, { access: "public" });

  const photo = await addPhoto(userId, sessionId, { url: blob.url, pathname: blob.pathname });
  if (!photo) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(photo, { status: 201 });
}
