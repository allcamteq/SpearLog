export type GpsFormat = "DD" | "DDM";

export type GpsCoordinate = { lat: number; lng: number };

function ddmPartToDecimal(deg: number, min: number, hemisphere: string | undefined): number {
  const value = deg + min / 60;
  return hemisphere === "S" || hemisphere === "W" ? -value : value;
}

const isLatHemisphere = (h: string | undefined) => h === "N" || h === "S";

// Matches a single "deg° min' [hemisphere]" or "[hemisphere] deg° min'" group,
// e.g. "59°54.834'N", "N 59 54.834", "10° 45.132' W".
const DDM_PART_RE = /([NSEW])?\s*(\d{1,3})[°\s]+(\d{1,2}(?:\.\d+)?)['′]?\s*([NSEW])?/g;

/** Tolerant coordinate parser: tries DDM ("59°54.834'N, 10°45.132'E") first, then falls back to plain DD ("59.9139, 10.7522"). Returns null if the text doesn't look like a coordinate pair. */
export function parseGps(input: string | null | undefined): GpsCoordinate | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const ddmMatches = [...trimmed.matchAll(DDM_PART_RE)].filter((m) => m[1] || m[4]);
  if (ddmMatches.length >= 2) {
    const [a, b] = ddmMatches;
    const aHemi = a[1] ?? a[4];
    const bHemi = b[1] ?? b[4];
    const aVal = ddmPartToDecimal(Number(a[2]), Number(a[3]), aHemi);
    const bVal = ddmPartToDecimal(Number(b[2]), Number(b[3]), bHemi);

    if (Number.isFinite(aVal) && Number.isFinite(bVal)) {
      const [lat, lng] = isLatHemisphere(bHemi) && !isLatHemisphere(aHemi) ? [bVal, aVal] : [aVal, bVal];
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }

  const parts = trimmed.split(/[,;\s]+/).filter(Boolean);
  if (parts.length === 2) {
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

function formatDDMPart(value: number, positiveHemisphere: string, negativeHemisphere: string): string {
  const hemisphere = value < 0 ? negativeHemisphere : positiveHemisphere;
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  return `${deg}°${min.toFixed(3)}'${hemisphere}`;
}

export function formatGps(lat: number, lng: number, format: GpsFormat): string {
  if (format === "DD") return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return `${formatDDMPart(lat, "N", "S")}, ${formatDDMPart(lng, "E", "W")}`;
}
