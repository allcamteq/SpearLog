import { NextResponse } from "next/server";
import { listMarks } from "@/db/queries/marks";
import { buildCsv } from "@/lib/csv";
import { getUserId } from "@/lib/auth-helpers";

const CSV_COLUMNS = ["name", "location", "location_details", "lat", "lng", "free_text"];

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const marks = await listMarks(userId);
  const rows = marks.map((m) => ({
    name: m.name,
    location: m.location,
    location_details: m.locationDetails,
    lat: m.lat,
    lng: m.lng,
    free_text: m.freeText,
  }));

  const csv = buildCsv(rows, CSV_COLUMNS);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="marks.csv"`,
    },
  });
}
