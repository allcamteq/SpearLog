import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { eq } from "drizzle-orm";
import { ipAddress } from "@vercel/functions";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { signupSchema } from "@/lib/validation/auth";
import { checkAndHit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = ipAddress(request) ?? "unknown";
  const allowed = await checkAndHit(`signup:ip:${ip}`, { windowMinutes: 60, limit: 5 });
  if (!allowed) {
    return NextResponse.json({ error: "Too many accounts created from this address. Try again later." }, { status: 429 });
  }

  const body = await request.json();
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, password, name } = parsed.data;

  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await hash(password, 10);
  await db.insert(users).values({ email, passwordHash, name: name || null });

  return NextResponse.json({ ok: true }, { status: 201 });
}
