import { NextRequest, NextResponse } from "next/server";
import { listSessions } from "@/db/queries/sessions";
import { listMarks } from "@/db/queries/marks";
import { parseSessionFilters } from "@/lib/filters";
import { buildCsv } from "@/lib/csv";
import { getUserId } from "@/lib/auth-helpers";

const CSV_COLUMNS = [
  "session_id",
  "date",
  "location",
  "location_details",
  "country",
  "number_of_dives",
  "rating",
  "fish_abundance",
  "comments",
  "high_tide_time",
  "low_tide_time",
  "start_time",
  "session_length_hours",
  "tide_type",
  "slack_tide_time",
  "tide_ratio",
  "current",
  "current_speed_kt",
  "sea_condition",
  "wind_condition",
  "wind_direction_deg",
  "pressure_hpa",
  "visibility_m",
  "depth_from_m",
  "depth_to_m",
  "gps_point",
  "catch_species",
  "catch_quantity",
  "catch_weight_kg",
  "catch_size_cm",
  "catch_mark",
];

export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const filters = parseSessionFilters(request.nextUrl.searchParams);
  const [results, userMarks] = await Promise.all([listSessions(userId, filters), listMarks(userId)]);
  const markNameById = new Map(userMarks.map((m) => [m.id, m.name]));

  const rows: Record<string, unknown>[] = results.flatMap((session) => {
    const base = {
      session_id: session.id,
      date: session.date,
      location: session.location,
      location_details: session.locationDetails,
      country: session.country,
      number_of_dives: session.numberOfDives,
      rating: session.rating,
      fish_abundance: session.fishAbundance,
      comments: session.comments,
      high_tide_time: session.highTideTime,
      low_tide_time: session.lowTideTime,
      start_time: session.startTime,
      session_length_hours: session.sessionLengthHours,
      tide_type: session.tideType,
      slack_tide_time: session.slackTideTime,
      tide_ratio: session.tideRatio,
      current: session.current,
      current_speed_kt: session.currentSpeedKt,
      sea_condition: session.seaCondition,
      wind_condition: session.windCondition,
      wind_direction_deg: session.windDirection,
      pressure_hpa: session.pressure,
      visibility_m: session.visibility,
      depth_from_m: session.depthFrom,
      depth_to_m: session.depthTo,
      gps_point: session.gpsPoint,
    };

    if (session.catches.length === 0) {
      return [
        {
          ...base,
          catch_species: null as string | null,
          catch_quantity: null as number | null,
          catch_weight_kg: null as number | null,
          catch_size_cm: null as number | null,
          catch_mark: null as string | null,
        },
      ];
    }

    return session.catches.map((c) => ({
      ...base,
      catch_species: c.species,
      catch_quantity: c.quantity,
      catch_weight_kg: c.weight,
      catch_size_cm: c.size,
      catch_mark: c.markId != null ? (markNameById.get(c.markId) ?? null) : null,
    }));
  });

  const csv = buildCsv(rows, CSV_COLUMNS);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fishlog-export.csv"`,
    },
  });
}
