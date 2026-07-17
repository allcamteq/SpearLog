import { NextRequest, NextResponse } from "next/server";
import { createSession, listSessions } from "@/db/queries/sessions";
import { sessionFormSchema } from "@/lib/validation/session";
import { parseSessionFilters } from "@/lib/filters";
import { getUserId } from "@/lib/auth-helpers";

export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const filters = parseSessionFilters(request.nextUrl.searchParams);
  const results = await listSessions(userId, filters);
  return NextResponse.json(results);
}

export async function POST(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = sessionFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const id = await createSession(userId, parsed.data.session, parsed.data.catches, parsed.data.marks);
  return NextResponse.json({ id }, { status: 201 });
}
