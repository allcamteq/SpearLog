import { NextRequest, NextResponse } from "next/server";
import { parseCsvRows, csvRowsToRecords } from "@/lib/csv";
import { sessionSchema, catchSchema, type SessionInput, type CatchInput } from "@/lib/validation/session";
import { createSession } from "@/db/queries/sessions";
import { listMarks } from "@/db/queries/marks";
import { getUserId } from "@/lib/auth-helpers";
import { toIsoDateString } from "@/lib/date";

type ImportGroup = {
  fields: Record<string, string>;
  catches: Record<string, string>[];
};

function groupRowsBySession(records: Record<string, string>[]): ImportGroup[] {
  const groups = new Map<string, ImportGroup>();
  const order: string[] = [];

  for (const record of records) {
    const key =
      record.session_id ||
      `${record.date}|${record.location}|${record.country}|${record.rating}`;

    let group = groups.get(key);
    if (!group) {
      group = { fields: record, catches: [] };
      groups.set(key, group);
      order.push(key);
    }

    if (record.catch_species) {
      group.catches.push(record);
    }
  }

  return order.map((key) => groups.get(key)!);
}

function toSessionInput(fields: Record<string, string>): SessionInput | null {
  const isoDate = toIsoDateString(fields.date);
  if (!isoDate) return null;

  const parsed = sessionSchema.safeParse({
    date: isoDate,
    location: fields.location,
    locationDetails: fields.location_details,
    country: fields.country,
    numberOfDives: fields.number_of_dives,
    rating: fields.rating,
    fishAbundance: fields.fish_abundance,
    comments: fields.comments,
    highTideTime: fields.high_tide_time,
    lowTideTime: fields.low_tide_time,
    startTime: fields.start_time,
    sessionLengthHours: fields.session_length_hours,
    tideType: fields.tide_type,
    slackTideTime: fields.slack_tide_time,
    tideRatio: fields.tide_ratio,
    current: fields.current,
    currentSpeedKt: fields.current_speed_kt,
    seaCondition: fields.sea_condition,
    windCondition: fields.wind_condition,
    windDirection: fields.wind_direction_deg,
    pressure: fields.pressure_hpa,
    visibility: fields.visibility_m,
    depthFrom: fields.depth_from_m,
    depthTo: fields.depth_to_m,
    gpsPoint: fields.gps_point,
  });

  return parsed.success ? parsed.data : null;
}

function toCatchInput(fields: Record<string, string>, marksByName: Map<string, number>): CatchInput | null {
  const markName = fields.catch_mark?.trim();
  const markId = markName ? marksByName.get(markName.toLowerCase()) : undefined;

  const parsed = catchSchema.safeParse({
    species: fields.catch_species,
    quantity: fields.catch_quantity || "1",
    weight: fields.catch_weight_kg,
    size: fields.catch_size_cm,
    markId,
  });

  return parsed.success ? parsed.data : null;
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const text = await request.text();
  if (!text.trim()) {
    return NextResponse.json({ error: "The uploaded file is empty" }, { status: 400 });
  }

  const records = csvRowsToRecords(parseCsvRows(text));
  if (records.length === 0) {
    return NextResponse.json({ error: "No data rows found in the file" }, { status: 400 });
  }

  const groups = groupRowsBySession(records);
  const userMarks = await listMarks(userId);
  const marksByName = new Map(userMarks.map((m) => [m.name.toLowerCase(), m.id]));
  const errors: string[] = [];
  let imported = 0;

  for (const [index, group] of groups.entries()) {
    const rowLabel = `Row ${index + 1} (${group.fields.location || "unknown location"}, ${group.fields.date || "unknown date"})`;

    if (!toIsoDateString(group.fields.date)) {
      errors.push(`${rowLabel}: unrecognized date format (use yyyy-mm-dd or dd/mm/yyyy)`);
      continue;
    }

    const sessionInput = toSessionInput(group.fields);
    if (!sessionInput) {
      errors.push(`${rowLabel}: invalid or missing session fields`);
      continue;
    }

    const catchInputs: CatchInput[] = [];
    let hasCatchError = false;
    for (const catchFields of group.catches) {
      const catchInput = toCatchInput(catchFields, marksByName);
      if (!catchInput) {
        hasCatchError = true;
        break;
      }
      catchInputs.push(catchInput);
    }
    if (hasCatchError) {
      errors.push(`${rowLabel}: invalid catch data`);
      continue;
    }

    await createSession(userId, sessionInput, catchInputs, []);
    imported++;
  }

  return NextResponse.json({ imported, total: groups.length, errors });
}
