import { NextRequest, NextResponse } from "next/server";
import { ipAddress } from "@vercel/functions";
import { resetConfirmSchema } from "@/lib/validation/auth";
import { consumeResetToken } from "@/lib/password-reset";
import { checkAndHit } from "@/lib/rate-limit";

const MESSAGES: Record<"invalid" | "expired" | "used", string> = {
  invalid: "That reset link isn't valid. Request a new one.",
  expired: "That reset link has expired. Request a new one.",
  used: "That reset link has already been used. Request a new one if you still need to change your password.",
};

/**
 * Spends a reset link and sets the new password.
 *
 * Rate limited by IP: the token is 32 random bytes so guessing it is not a
 * realistic attack, but without a limit this endpoint would still accept
 * unlimited attempts and do a database lookup for each.
 */
export async function POST(request: NextRequest) {
  const ip = ipAddress(request) ?? "unknown";
  const allowed = await checkAndHit(`reset-confirm:ip:${ip}`, { windowMinutes: 60, limit: 20 });
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = resetConfirmSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues.find((i) => i.path[0] === "password");
    return NextResponse.json(
      { error: issue?.message ?? "A reset link and a new password are required." },
      { status: 400 }
    );
  }

  const result = await consumeResetToken(parsed.data.token, parsed.data.password);
  if (!result.ok) {
    return NextResponse.json({ error: MESSAGES[result.reason] }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
