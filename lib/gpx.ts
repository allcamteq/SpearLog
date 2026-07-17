import { XMLParser } from "fast-xml-parser";

export type GpxWaypoint = { name: string; lat: number; lng: number };
export type GpxMark = { name: string; lat: number | null; lng: number | null };

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      default:
        return "&quot;";
    }
  });
}

/** Builds a GPX 1.1 document from marks. Marks without coordinates are skipped — a GPX waypoint requires lat/lon. */
export function buildGpx(marks: GpxMark[]): string {
  const waypoints = marks.filter((m): m is GpxWaypoint => m.lat != null && m.lng != null);

  const wpts = waypoints
    .map((w) => `  <wpt lat="${w.lat}" lon="${w.lng}"><name>${escapeXml(w.name)}</name></wpt>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="SpearLog" xmlns="http://www.topografix.com/GPX/1/1">\n${wpts}\n</gpx>\n`;
}

/** Parses waypoints out of a GPX document, tolerant of the namespace/attribute-order/whitespace variation seen across real GPS devices and apps. */
export function parseGpx(xmlText: string): GpxWaypoint[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", parseAttributeValue: true });
  const parsed = parser.parse(xmlText);

  const rawWpts = parsed?.gpx?.wpt;
  const wpts = Array.isArray(rawWpts) ? rawWpts : rawWpts ? [rawWpts] : [];

  const waypoints: GpxWaypoint[] = [];
  for (const wpt of wpts) {
    const lat = Number(wpt?.lat);
    const lng = Number(wpt?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const rawName = wpt?.name;
    const name = (typeof rawName === "string" ? rawName : typeof rawName === "object" ? rawName?.["#text"] : undefined)?.trim();

    waypoints.push({ name: name || "Unnamed mark", lat, lng });
  }
  return waypoints;
}
