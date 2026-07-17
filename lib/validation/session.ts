import { z } from "zod";
import { TIDE_TYPES, CURRENT_LEVELS, SEA_CONDITIONS, WIND_CONDITIONS } from "@/db/schema";
import { blankToUndefined, optionalString, optionalNumber } from "@/lib/validation/shared";

export const catchSchema = z.object({
  species: z.string().min(1, "Species is required"),
  quantity: z.coerce.number().int().min(1),
  weight: optionalNumber(0),
  size: optionalNumber(0),
  markId: optionalNumber(1, undefined, true),
});

export const sessionMarkSchema = z.object({
  markId: z.coerce.number().int(),
});

// A row added via "+ Add mark" but left unselected has no markId yet — that's
// an empty optional slot, not invalid input, so it shouldn't block saving the
// rest of the form. Filtered out in sessionFormSchema below.
const sessionMarkRowSchema = z.object({
  markId: optionalNumber(1, undefined, true),
});

export const sessionSchema = z.object({
  date: optionalString(),
  location: optionalString(),
  locationDetails: z.string().optional().nullable(),
  country: optionalString(),
  numberOfDives: optionalNumber(0, undefined, true),
  comments: z.string().optional().nullable(),

  highTideTime: z.string().optional().nullable(),
  lowTideTime: z.string().optional().nullable(),
  startTime: z.string().optional().nullable(),
  sessionLengthHours: optionalNumber(0),
  tideType: z.preprocess(blankToUndefined, z.enum(TIDE_TYPES).optional().nullable()),
  slackTideTime: z.string().optional().nullable(),
  tideRatio: optionalNumber(),

  current: z.preprocess(blankToUndefined, z.enum(CURRENT_LEVELS).optional().nullable()),
  currentSpeedKt: optionalNumber(0),
  seaCondition: z.preprocess(blankToUndefined, z.enum(SEA_CONDITIONS).optional().nullable()),
  windCondition: z.preprocess(blankToUndefined, z.enum(WIND_CONDITIONS).optional().nullable()),
  windDirection: optionalNumber(0, 360),
  pressure: optionalNumber(),
  visibility: optionalNumber(0),
  depthFrom: optionalNumber(0),
  depthTo: optionalNumber(0),

  gpsPoint: z.string().optional().nullable(),

  rating: optionalNumber(1, 5, true),
  fishAbundance: optionalNumber(1, 5, true),
});

export const sessionFormSchema = z.object({
  session: sessionSchema,
  catches: z.array(catchSchema).default([]),
  marks: z
    .array(sessionMarkRowSchema)
    .default([])
    .transform((rows) => rows.filter((r): r is { markId: number } => r.markId != null)),
});

export type CatchInput = z.infer<typeof catchSchema>;
export type SessionMarkInput = z.infer<typeof sessionMarkSchema>;
export type SessionInput = z.infer<typeof sessionSchema>;
export type SessionFormInput = z.infer<typeof sessionFormSchema>;

// react-hook-form needs the pre-coercion shape for `defaultValues`/`register`
// (z.coerce fields accept `unknown` on input) and the post-coercion shape for
// the validated `onSubmit` payload — hence the separate input/output types.
export type SessionFormValues = z.input<typeof sessionFormSchema>;
export type SessionFormOutput = z.output<typeof sessionFormSchema>;

export const sessionFilterSchema = z.object({
  location: z.string().optional(),
  country: z.string().optional(),
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  maxRating: z.coerce.number().int().min(1).max(5).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  species: z.string().optional(),
  mark: z.string().optional(),
  tideType: z.enum(TIDE_TYPES).optional(),
  hasComments: z.literal("true").optional(),
  hasMarks: z.literal("true").optional(),
  hasFish: z.literal("true").optional(),
});

export type SessionFilterInput = z.infer<typeof sessionFilterSchema>;
