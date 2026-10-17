import { sqliteTable, text, integer, real, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const TIDE_TYPES = ["High", "High to Low", "Low", "Low to High"] as const;
export const CURRENT_LEVELS = ["Zero", "Low", "Medium", "High"] as const;
export const SEA_CONDITIONS = ["Calm", "Rough", "Very Rough"] as const;
export const WIND_CONDITIONS = ["Calm", "Moderate", "Strong"] as const;

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(), // stored lowercased
    passwordHash: text("password_hash").notNull(),
    name: text("name"),
    privateGpsEnabled: integer("private_gps_enabled", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)]
);

// User-maintained dropdown vocabularies (managed on the Maintenance page).
// Unlike TIDE_TYPES/CURRENT_LEVELS, these are open-ended and stored in the DB.
export const OPTION_CATEGORIES = ["location", "locationDetails", "country", "species"] as const;

export const optionValues = sqliteTable(
  "option_values",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    category: text("category", { enum: OPTION_CATEGORIES }).notNull(),
    value: text("value").notNull(),
    // Populated by "Check location" (category === "location" only) so tide/current
    // lookups can reuse a verified geocode instead of re-querying the geocoder each time.
    lat: real("lat"),
    lng: real("lng"),
    resolvedAddress: text("resolved_address"),
  },
  (table) => [uniqueIndex("option_values_user_category_value_idx").on(table.userId, table.category, table.value)]
);

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),

  date: text("date"), // "YYYY-MM-DD"
  location: text("location"),
  locationDetails: text("location_details"), // e.g. entry point, landmarks, site description
  country: text("country"),
  numberOfDives: integer("number_of_dives"),
  comments: text("comments"),

  highTideTime: text("high_tide_time"), // "HH:MM"
  lowTideTime: text("low_tide_time"), // "HH:MM"
  startTime: text("start_time"), // "HH:MM", when the session started
  sessionLengthHours: real("session_length_hours"), // duration in hours
  tideType: text("tide_type", { enum: TIDE_TYPES }),
  slackTideTime: text("slack_tide_time"), // "HH:MM"
  tideRatio: real("tide_ratio"), // high/low tide coefficient

  current: text("current", { enum: CURRENT_LEVELS }), // Zero (0kt) / Low (0-0.5kt) / Medium (0.5-1kt) / High (1-2kt)
  currentSpeedKt: real("current_speed_kt"), // raw current speed in knots, from Stormglass
  seaCondition: text("sea_condition", { enum: SEA_CONDITIONS }),
  windCondition: text("wind_condition", { enum: WIND_CONDITIONS }),
  windDirection: real("wind_direction"), // degrees, 0-360, from Stormglass
  pressure: real("pressure"), // hPa, from Stormglass
  visibility: real("visibility"), // meters
  depthFrom: real("depth_from"), // meters
  depthTo: real("depth_to"), // meters

  gpsPoint: text("gps_point"), // free-form, e.g. "59.91, 10.75"

  rating: integer("rating"), // 1-5
  fishAbundance: integer("fish_abundance"), // 1-5, how much fish/life was seen

  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const catches = sqliteTable("catches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),

  species: text("species").notNull(),
  quantity: integer("quantity").notNull().default(1),
  weight: real("weight"), // kg
  size: real("size"), // cm
  markId: integer("mark_id").references(() => marks.id, { onDelete: "set null" }),
});

// A named fishing spot with an optional GPS location. Maintained centrally
// (Maintenance page) and reused by name from catches (single mark) and
// sessions (multiple marks, via session_marks).
export const marks = sqliteTable(
  "marks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    location: text("location"), // free text, same vocabulary as sessions.location
    locationDetails: text("location_details"),
    lat: real("lat"), // decimal degrees, canonical storage
    lng: real("lng"),
    gpsEncrypted: text("gps_encrypted"),
    freeText: text("free_text"), // fallback description for when someone doesn't want to record exact GPS
    comments: text("comments"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [uniqueIndex("marks_user_name_idx").on(table.userId, table.name)]
);

export const sessionMarks = sqliteTable("session_marks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  markId: integer("mark_id")
    .notNull()
    .references(() => marks.id, { onDelete: "cascade" }),
});

/**
 * Outstanding password-reset links — see lib/password-reset.ts.
 *
 * `tokenHash` is a SHA-256 of the token, never the token itself: the plain
 * value exists only in the email, so a leaked database can't be used to reset
 * anyone's password. Rows are kept after use rather than deleted, so a reused
 * link can be told apart from an expired or forged one.
 */
export const passwordResetTokens = sqliteTable(
  "password_reset_tokens",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(), // "YYYY-MM-DD HH:MM:SS", UTC
    usedAt: text("used_at"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    uniqueIndex("password_reset_tokens_hash_idx").on(table.tokenHash),
    index("password_reset_tokens_user_idx").on(table.userId),
  ]
);

// Sliding-window hit log for abuse checks (signup/login) — see lib/rate-limit.ts.
export const rateLimitHits = sqliteTable(
  "rate_limit_hits",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    bucket: text("bucket").notNull(), // e.g. "signup:ip:1.2.3.4", "login:email:foo@bar.com"
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [index("rate_limit_hits_bucket_idx").on(table.bucket, table.createdAt)]
);

// Daily per-user counters for metered third-party providers (LocationIQ, Stormglass)
// so one user can't exhaust the app-wide free-tier quota — see lib/rate-limit.ts.
export const providerUsage = sqliteTable(
  "provider_usage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    provider: text("provider", { enum: ["locationiq", "stormglass"] }).notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
    day: text("day").notNull(), // "YYYY-MM-DD", UTC
    count: integer("count").notNull().default(0),
  },
  (table) => [uniqueIndex("provider_usage_provider_user_day_idx").on(table.provider, table.userId, table.day)]
);

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
export type CatchRow = typeof catches.$inferSelect;
export type NewCatchRow = typeof catches.$inferInsert;
export type OptionValueRow = typeof optionValues.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type MarkRow = typeof marks.$inferSelect;
export type NewMarkRow = typeof marks.$inferInsert;
export type SessionMarkRow = typeof sessionMarks.$inferSelect;
