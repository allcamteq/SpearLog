/**
 * Outbound email, via Resend's HTTP API.
 *
 * Deliberately a direct fetch rather than the SDK: one endpoint is needed, and
 * a dependency that ships its own HTTP stack isn't worth it for a single POST.
 *
 * When RESEND_API_KEY is unset the message is logged to the server console
 * instead of being sent, and `delivered` comes back false. That keeps local
 * development working without an account — the reset link is printed where the
 * developer can copy it — but it means a production deploy with no key will
 * accept reset requests and silently deliver nothing, so callers that care
 * should check `delivered`.
 */

export type SendResult = { delivered: boolean; error?: string };

/** Verified sender. Resend rejects a domain it hasn't verified, so this must match the account's. */
const FROM = process.env.EMAIL_FROM ?? "SpearLog <noreply@spearlog.app>";

export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Not an error in development, and the body is logged in full on purpose:
    // without it there is no way to complete a reset locally.
    console.info(`[mail] RESEND_API_KEY unset — not sending. To: ${to}\nSubject: ${subject}\n\n${text}`);
    return { delivered: false, error: "no_api_key" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, text }),
    });

    if (!res.ok) {
      // Logged, never returned to the caller's user: the response can name the
      // sending domain and the account, and the reset endpoint deliberately
      // reveals nothing about what happened.
      const detail = await res.text().catch(() => "");
      console.error(`[mail] Resend rejected the send (${res.status}): ${detail.slice(0, 500)}`);
      return { delivered: false, error: `resend_${res.status}` };
    }

    return { delivered: true };
  } catch (error) {
    console.error("[mail] Could not reach Resend:", error);
    return { delivered: false, error: "unreachable" };
  }
}
