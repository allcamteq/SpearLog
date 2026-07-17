import { z } from "zod";
import { optionalString, optionalNumber } from "@/lib/validation/shared";

export const markSchema = z.object({
  name: z.string().min(1, "Name is required"),
  location: optionalString(),
  locationDetails: optionalString(),
  lat: optionalNumber(-90, 90),
  lng: optionalNumber(-180, 180),
  freeText: optionalString(),
  comments: optionalString(),
});

export type MarkInput = z.infer<typeof markSchema>;

export const markFilterSchema = z.object({
  location: z.string().optional(),
  mark: z.string().optional(),
});

export type MarkFilterInput = z.infer<typeof markFilterSchema>;
