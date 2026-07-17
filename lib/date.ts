/** Parses either ISO ("YYYY-MM-DD") or "DD/MM/YYYY" into a UTC Date, or null if neither matches. */
export function parseFlexibleDate(input: string | null | undefined): Date | null {
  if (!input) return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input.trim());
  if (iso) {
    const [, y, m, d] = iso;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input.trim());
  if (dmy) {
    const [, d, m, y] = dmy;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/** Normalizes either accepted input format to canonical "YYYY-MM-DD" storage, or null if unparseable. */
export function toIsoDateString(input: string | null | undefined): string | null {
  const date = parseFlexibleDate(input);
  return date ? date.toISOString().slice(0, 10) : null;
}

/** Formats a stored date value for display as "DD/MM/YYYY". Falls back to the raw string if it can't be parsed. */
export function formatDateDisplay(input: string | null | undefined): string {
  if (!input) return "";
  const date = parseFlexibleDate(input);
  if (!date) return input;
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
