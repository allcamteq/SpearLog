import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUserId } from "@/lib/auth-helpers";
import { planTrip, StormglassError } from "@/lib/trip-conditions";
import { checkProviderQuota } from "@/lib/rate-limit";

// Stormglass serves roughly a week of history and ten days of forecast; asking
// outside that returns a window with no usable hours rather than an error, so
// reject it here where we can say why.
const MAX_DAYS_AHEAD = 10;
const MAX_DAYS_BACK = 5;

const bodySchema = z.object({
  location: z.string().min(1),
  country: z.string().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  workingDepthM: z.number().min(3).max(30).default(10),
  shoreFacingDeg: z.number().min(0).max(360).nullable().default(null),
  estuaryInfluence: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A location and a valid date are required" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const daysOut = Math.round(
    (new Date(`${parsed.data.date}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000
  );
  if (daysOut > MAX_DAYS_AHEAD) {
    return NextResponse.json(
      { error: `Marine forecasts only run about ${MAX_DAYS_AHEAD} days ahead. Pick a nearer date.` },
      { status: 400 }
    );
  }
  if (daysOut < -MAX_DAYS_BACK) {
    return NextResponse.json(
      { error: "That date is too far in the past to plan against. Log it as a session instead." },
      { status: 400 }
    );
  }

  // One evaluation spends two Stormglass requests: the hourly forecast and the tides.
  if (!(await checkProviderQuota(userId, "stormglass", 2))) {
    return NextResponse.json({ error: "Daily conditions-lookup limit reached. Try again tomorrow." }, { status: 429 });
  }

  try {
    return NextResponse.json(await planTrip(userId, parsed.data));
  } catch (error) {
    if (error instanceof StormglassError) {
      const status =
        error.code === "missing_key" || error.code === "unauthorized"
          ? 500
          : error.code === "quota_exceeded"
            ? 429
            : 502;
      return NextResponse.json({ error: error.message }, { status });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Could not evaluate conditions for that trip" }, { status: 502 });
  }
}
