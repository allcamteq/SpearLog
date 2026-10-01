/**
 * Password reset: issuing a link, and spending it.
 *
 * The rules this follows, and why:
 *
 *  - **Only a hash is stored.** The token in the email is 32 random bytes; the
 *    database holds its SHA-256. Someone who reads the table cannot reset
 *    anyone's password, and the lookup is still a single indexed equality.
 *  - **Nothing reveals whether an account exists.** `requestReset` returns the
 *    same thing for a registered address and an unregistered one, so the form
 *    can't be used to enumerate users. The caller must not vary its response
 *    either.
 *  - **One link, once.** Spending a token stamps `usedAt`, and every other
 *    outstanding token for that user is expired at the same time — a second
 *    reset request invalidates the first link, and a used link can be told
 *    apart from a forged one for the error message.
 *  - **Short-lived.** An hour. Long enough to find the mail, short enough that
 *    a link left in an inbox stops mattering.
 *
 * Timestamps are stored as "YYYY-MM-DD HH:MM:SS" in UTC to match the string
 * comparison the rest of the schema relies on (SQLite's `current_timestamp`).
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { hash } from "bcryptjs";
import { db } from "@/db/client";
import { passwordResetTokens, users } from "@/db/schema";

const TOKEN_TTL_MINUTES = 60;
const BCRYPT_ROUNDS = 10;

function sqliteTimestamp(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type ResetRequestOutcome = {
  /** True when a mail was actually handed to the provider. Never surface this to the requester. */
  delivered: boolean;
  /** Present only when the address matched an account and a link was minted. */
  token?: string;
  email?: string;
};

/**
 * Mints a reset token for `email` if it belongs to an account.
 *
 * Returns no token when the address is unknown, and the caller must respond
 * identically either way. Sending the mail is the caller's job so this stays
 * free of I/O beyond the database.
 */
export async function createResetToken(email: string): Promise<ResetRequestOutcome> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return { delivered: false };

  // Any link already in their inbox stops working now. Someone who asks twice
  // expects the newest mail to be the live one, and it caps how many valid
  // links can exist for an account at one time.
  await db
    .update(passwordResetTokens)
    .set({ expiresAt: sqliteTimestamp(Date.now() - 1000) })
    .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)));

  const token = randomBytes(32).toString("base64url");
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    tokenHash: hashToken(token),
    expiresAt: sqliteTimestamp(Date.now() + TOKEN_TTL_MINUTES * 60_000),
  });

  return { delivered: false, token, email: user.email };
}

export type ConsumeResult =
  | { ok: true; userId: number }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/**
 * Spends a reset token and sets the new password in one transaction.
 *
 * `invalid` covers both a forged token and one that never existed; they are
 * indistinguishable by design. `used` and `expired` are separated only so the
 * page can tell someone to request a fresh link rather than leaving them
 * guessing — neither tells an attacker anything they couldn't already try.
 */
export async function consumeResetToken(token: string, newPassword: string): Promise<ConsumeResult> {
  if (!token) return { ok: false, reason: "invalid" };

  const tokenHash = hashToken(token);
  const [row] = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash));
  if (!row) return { ok: false, reason: "invalid" };

  // The lookup above is already an exact-match index hit, so the hash is known
  // to be equal; this guards against a future change to a non-unique lookup.
  const expected = Buffer.from(row.tokenHash);
  const actual = Buffer.from(tokenHash);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: "invalid" };
  }

  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.expiresAt <= sqliteTimestamp(Date.now())) return { ok: false, reason: "expired" };

  const passwordHash = await hash(newPassword, BCRYPT_ROUNDS);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, row.userId));

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: sql`(current_timestamp)` })
      .where(eq(passwordResetTokens.id, row.id));

    // Belt and braces: createResetToken already expires siblings when a link is
    // minted, but a token issued before that behaviour existed shouldn't
    // outlive the password it was issued against.
    await tx
      .update(passwordResetTokens)
      .set({ expiresAt: sqliteTimestamp(Date.now() - 1000) })
      .where(and(eq(passwordResetTokens.userId, row.userId), isNull(passwordResetTokens.usedAt)));
  });

  return { ok: true, userId: row.userId };
}

/** Drops spent and long-expired rows. Called opportunistically when a reset is requested, so the table can't grow without bound. */
export async function pruneResetTokens(): Promise<void> {
  const cutoff = sqliteTimestamp(Date.now() - 7 * 24 * 60 * 60_000);
  await db.delete(passwordResetTokens).where(lt(passwordResetTokens.expiresAt, cutoff));
}
