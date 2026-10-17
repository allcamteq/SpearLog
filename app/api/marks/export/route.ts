import { NextResponse } from "next/server";
import { listMarks } from "@/db/queries/marks";
import { buildGpx } from "@/lib/gpx";
import { getUserId } from "@/lib/auth-helpers";
import { getUserById } from "@/db/queries/users";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((await getUserById(userId))?.privateGpsEnabled) {
    return NextResponse.json({ error: "Unlock marks on the Marks page to export GPS coordinates." }, { status: 409 });
  }

  const marks = await listMarks(userId);
  const gpx = buildGpx(marks);

  return new NextResponse(gpx, {
    status: 200,
    headers: {
      "Content-Type": "application/gpx+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="marks.gpx"`,
    },
  });
}
