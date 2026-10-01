import { NextRequest, NextResponse } from "next/server";
import { ipAddress } from "@vercel/functions";
import { resetRequestSchema } from "@/lib/validation/auth";
import { createResetToken, pruneResetTokens } from "@/lib/password-reset";
import { checkAndHit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/mail";
import { CONTACT_EMAIL } from "@/lib/contact";

/**
 * Requests a reset link.
 *
 * Always answers `{ ok: true }` — for an unknown address, a known one, a
 * malformed one, and a send that failed. The response must not let anyone learn
 * whether an address has an account, which rules out reporting delivery
 * failures to the requester too; those go to the server log.
 *
 * Rate limited by address and by IP. The per-address limit stops someone
 * flooding one person's inbox; the per-IP limit stops a sweep across many
 * addresses, which is also what protects the mail quota.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = resetRequestSchema.safeParse(body);

  const ip = ipAddress(request) ?? "unknown";
  const okIp = await checkAndHit(`reset:ip:${ip}`, { windowMinutes: 60, limit: 10 });
  if (!okIp) {
    // The one case worth answering honestly: it tells the requester nothing
    // about any account, and silently dropping it would look like a broken form.
    return NextResponse.json(
      { error: "Too many reset requests from this address. Try again later." },
      { status: 429 }
    );
  }

  if (!parsed.success) return NextResponse.json({ ok: true });

  const { email } = parsed.data;
  const okEmail = await checkAndHit(`reset:email:${email}`, { windowMinutes: 60, limit: 3 });
  if (!okEmail) return NextResponse.json({ ok: true });

  const outcome = await createResetToken(email);

  if (outcome.token && outcome.email) {
    const origin = request.nextUrl.origin;
    const link = `${origin}/reset-password?token=${encodeURIComponent(outcome.token)}`;

    const result = await sendEmail({
      to: outcome.email,
      subject: "Reset your SpearLog password",
      text: [
        "Someone asked to reset the password for your SpearLog account.",
        "",
        "Open this link to choose a new one. It expires in an hour and works once:",
        link,
        "",
        "If that wasn't you, ignore this message — your password hasn't changed, and",
        "the link above is the only way to change it.",
        "",
        `Questions: ${CONTACT_EMAIL}`,
      ].join("\n"),
    });

    if (!result.delivered) {
      console.error(`[password-reset] Could not deliver a reset link (${result.error ?? "unknown"}).`);
    }
  }

  // Opportunistic and non-blocking: a failure here must not fail the request.
  pruneResetTokens().catch(() => {});

  return NextResponse.json({ ok: true });
}
