const BASE_URL = "https://api.stormglass.io/v2";
const MS_TO_KT = 1.943844;

export class StormglassError extends Error {
  constructor(
    message: string,
    public code: "missing_key" | "unauthorized" | "quota_exceeded" | "no_data" | "request_failed"
  ) {
    super(message);
    this.name = "StormglassError";
  }
}

export type TideExtreme = {
  time: string; // ISO, UTC
  type: "high" | "low";
  height: number;
};

function apiKey(): string {
  const key = process.env.STORMGLASS_API_KEY;
  if (!key) throw new StormglassError("STORMGLASS_API_KEY is not set", "missing_key");
  return key;
}

async function stormglassFetch(path: string, params: Record<string, string>): Promise<unknown> {
  const url = `${BASE_URL}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { Authorization: apiKey() } });

  if (res.status === 401) throw new StormglassError("Stormglass API key was rejected", "unauthorized");
  if (res.status === 402 || res.status === 429) {
    // Stormglass's quota-exceeded body includes `meta.dailyQuota` (e.g. {"errors":{"key":"API quota exceeded"},"meta":{"dailyQuota":10,"requestCount":13}}),
    // so surface the actual daily limit instead of a bare "quota exceeded".
    const body = (await res.json().catch(() => null)) as { meta?: { dailyQuota?: number } } | null;
    const quota = body?.meta?.dailyQuota;
    const message = quota
      ? `Stormglass's free-tier daily limit (${quota} requests/day) has been reached. Try again tomorrow.`
      : "Stormglass daily request quota exceeded. Try again tomorrow.";
    throw new StormglassError(message, "quota_exceeded");
  }
  if (!res.ok) throw new StormglassError(`Stormglass request failed (${res.status})`, "request_failed");

  return res.json();
}

/** Every Stormglass weather parameter is keyed by data source (e.g. "sg", "noaa"); prefer the blended "sg" value, else the first available. */
function pickSourceValue(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.sg === "number") return record.sg;
    const first = Object.values(record).find((v) => typeof v === "number");
    if (typeof first === "number") return first;
  }
  return null;
}

export async function getTideExtremes(lat: number, lng: number, startISO: string, endISO: string): Promise<TideExtreme[]> {
  const json = (await stormglassFetch("/tide/extremes/point", {
    lat: String(lat),
    lng: String(lng),
    start: startISO,
    end: endISO,
  })) as { data?: { time: string; type: string; height: number }[] };

  const data = json.data ?? [];
  if (data.length === 0) {
    throw new StormglassError("No tide station data available near this location", "no_data");
  }

  return data
    .filter((d): d is { time: string; type: "high" | "low"; height: number } => d.type === "high" || d.type === "low")
    .map((d) => ({ time: d.time, type: d.type, height: d.height }));
}

export type MarineConditions = {
  currentSpeedKt: number | null;
  waveHeightM: number | null;
  windSpeedKt: number | null;
  windDirectionDeg: number | null;
  pressureHpa: number | null;
};

/** Fetches current speed, wave height, wind speed/direction, and pressure in a single request (one Stormglass call covers all five) at the closest available hour to the given time. */
export async function getMarineConditions(lat: number, lng: number, timeISO: string): Promise<MarineConditions> {
  const start = new Date(timeISO);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const json = (await stormglassFetch("/weather/point", {
    lat: String(lat),
    lng: String(lng),
    params: "currentSpeed,waveHeight,windSpeed,windDirection,pressure",
    start: start.toISOString(),
    end: end.toISOString(),
  })) as {
    hours?: {
      time: string;
      currentSpeed?: unknown;
      waveHeight?: unknown;
      windSpeed?: unknown;
      windDirection?: unknown;
      pressure?: unknown;
    }[];
  };

  const hour = json.hours?.[0];
  if (!hour) {
    return { currentSpeedKt: null, waveHeightM: null, windSpeedKt: null, windDirectionDeg: null, pressureHpa: null };
  }

  const currentSpeedMs = pickSourceValue(hour.currentSpeed);
  const windSpeedMs = pickSourceValue(hour.windSpeed);

  return {
    currentSpeedKt: currentSpeedMs != null ? currentSpeedMs * MS_TO_KT : null,
    waveHeightM: pickSourceValue(hour.waveHeight),
    windSpeedKt: windSpeedMs != null ? windSpeedMs * MS_TO_KT : null,
    windDirectionDeg: pickSourceValue(hour.windDirection),
    pressureHpa: pickSourceValue(hour.pressure),
  };
}
