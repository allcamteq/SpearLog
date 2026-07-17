import { z } from "zod";

// Untouched optional <input>/<select> fields submit "" (empty string), not
// undefined. z.coerce.number() would silently coerce that to 0, and
// z.enum(...).optional() rejects "" outright (only undefined is "absent"),
// which blocks submission with no visible error. Normalize "" to undefined
// before the real schema runs.
export const blankToUndefined = (val: unknown) => (val === "" ? undefined : val);

export const optionalString = () => z.preprocess(blankToUndefined, z.string().optional().nullable());

export const optionalNumber = (min?: number, max?: number, int = false) => {
  let schema = z.coerce.number();
  if (int) schema = schema.int();
  if (min !== undefined) schema = schema.min(min);
  if (max !== undefined) schema = schema.max(max);
  return z.preprocess(blankToUndefined, schema.optional().nullable());
};
