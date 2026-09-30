import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { rateLimitHits, providerUsage } from "@/db/schema";

function sqliteTimestamp(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

/**
 * Sliding-window abuse check: records a hit for `bucket` and returns whether
 * it's still under `limit` hits within the last `windowMinutes`. Used for
 * signup/login throttling — not meant for high-traffic hot paths, since each
 * call does a delete+count+insert against Turso.
 */
export async function checkAndHit(bucket: string, { windowMinutes, limit }: { windowMinutes: number; limit: number }): Promise<boolean> {
  const cutoff = sqliteTimestamp(Date.now() - windowMinutes * 60_000);
  await db.delete(rateLimitHits).where(and(eq(rateLimitHits.bucket, bucket), lt(rateLimitHits.createdAt, cutoff)));

  const [row] = await db
    .select({ value: sql<number>`count(*)` })
    .from(rateLimitHits)
    .where(eq(rateLimitHits.bucket, bucket));
  if ((row?.value ?? 0) >= limit) return false;

  await db.insert(rateLimitHits).values({ bucket });
  return true;
}

type Provider = "locationiq" | "stormglass";

// Daily caps kept comfortably under each provider's free-tier quota
// (LocationIQ ~5000/day, Stormglass ~50/day) so one user can't exhaust it for everyone.
const DAILY_LIMITS: Record<Provider, { perUser: number; global: number }> = {
  locationiq: { perUser: 300, global: 4500 },
  stormglass: { perUser: 10, global: 22 },
};

/**
 * Increments today's usage counter for `provider`/`userId` and reports whether the
 * per-user and app-wide daily caps still allow it. Call once per user-visible
 * provider action (not per raw HTTP request), passing `cost` when one action
 * makes several upstream calls — trip planning spends two Stormglass requests.
 */
export async function checkProviderQuota(userId: number, provider: Provider, cost = 1): Promise<boolean> {
  const day = new Date().toISOString().slice(0, 10);
  const { perUser, global } = DAILY_LIMITS[provider];

  const [userRow] = await db
    .select({ count: providerUsage.count })
    .from(providerUsage)
    .where(and(eq(providerUsage.provider, provider), eq(providerUsage.userId, userId), eq(providerUsage.day, day)));
  const [globalRow] = await db
    .select({ total: sql<number>`coalesce(sum(${providerUsage.count}), 0)` })
    .from(providerUsage)
    .where(and(eq(providerUsage.provider, provider), eq(providerUsage.day, day)));

  if ((userRow?.count ?? 0) + cost > perUser || (globalRow?.total ?? 0) + cost > global) return false;

  await db
    .insert(providerUsage)
    .values({ provider, userId, day, count: cost })
    .onConflictDoUpdate({
      target: [providerUsage.provider, providerUsage.userId, providerUsage.day],
      set: { count: sql`${providerUsage.count} + ${cost}` },
    });

  return true;
}
