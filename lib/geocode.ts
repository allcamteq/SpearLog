export type GeocodeResult = {
  lat: number;
  lng: number;
  displayName: string;
  country: string | null;
};

const LOCATIONIQ_BASE_URL = "https://us1.locationiq.com/v1";

function locationIqKey(): string | undefined {
  return process.env.LOCATIONIQ_API_KEY;
}

async function locationIqFetch(path: string, params: Record<string, string>): Promise<Response | null> {
  const key = locationIqKey();
  if (!key) return null;

  const url = `${LOCATIONIQ_BASE_URL}${path}?${new URLSearchParams({ ...params, key, format: "json" })}`;
  const res = await fetch(url);

  if (!res.ok) {
    // Geocoding failures are surfaced to callers as a plain `null` (see below),
    // so log the real reason here — otherwise a bad/expired key or an exceeded
    // quota just looks like "no results" to the end user.
    const body = await res.text().catch(() => "");
    console.error(`LocationIQ request to ${path} failed (${res.status}): ${body.slice(0, 300)}`);
    return null;
  }

  return res;
}

async function nominatimFetch(path: string, params: Record<string, string>): Promise<Response | null> {
  const url = `https://nominatim.openstreetmap.org${path}?${new URLSearchParams({ ...params, format: "json" })}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "SpearLog/1.0 (personal spearfishing log; contact via app owner)" },
  });
  return res.ok ? res : null;
}

/**
 * Picks the geocoding provider per-request: LocationIQ when a key is
 * configured, otherwise the free Nominatim endpoint. Nominatim's usage policy
 * blocks/rate-limits requests from cloud & datacenter IPs (including Vercel's)
 * regardless of User-Agent, so it only works reliably from a home/office IP —
 * fine for zero-config local dev, but LOCATIONIQ_API_KEY must be set in any
 * hosted environment or every geocode lookup will silently fail.
 */
function providerFetch(path: { locationIq: string; nominatim: string }, params: Record<string, string>) {
  return locationIqKey() ? locationIqFetch(path.locationIq, params) : nominatimFetch(path.nominatim, params);
}

async function queryGeocoder(query: string): Promise<GeocodeResult | null> {
  const res = await providerFetch({ locationIq: "/search.php", nominatim: "/search" }, { q: query, addressdetails: "1", limit: "1" });
  if (!res) return null;

  const results = (await res.json()) as {
    lat: string;
    lon: string;
    display_name: string;
    address?: { country?: string };
  }[];
  const first = results[0];
  if (!first) return null;

  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng, displayName: first.display_name, country: first.address?.country ?? null };
}

/**
 * Geocodes a free-text location (+ optional country) into coordinates.
 *
 * Tries the location on its own first — appending country when the location
 * text already names it (e.g. "Plymouth, UK" + country "United Kingdom")
 * produces a query that often can't be resolved. Country is only appended
 * as a fallback disambiguation attempt if the plain query comes up empty.
 */
export async function geocodeLocation(location: string, country?: string | null): Promise<GeocodeResult | null> {
  const direct = await queryGeocoder(location);
  if (direct) return direct;

  if (country && !location.toLowerCase().includes(country.toLowerCase())) {
    return queryGeocoder(`${location}, ${country}`);
  }

  return null;
}

export type ReverseGeocodeResult = {
  location: string;
  country: string | null;
  displayName: string;
};

/**
 * Reverse-geocodes a coordinate to a place name — picks the most "town/city"-sized
 * address component, falling back to progressively broader ones (county, then
 * state/region, then country) so a remote mark still resolves to something
 * usable. Marks well offshore often have no town/county match at all — only a
 * country via its territorial-waters boundary — so the fallback chain has to
 * reach all the way to `country` or those marks would come back as
 * unresolvable even though a match was found.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const res = await providerFetch(
    { locationIq: "/reverse.php", nominatim: "/reverse" },
    { lat: String(lat), lon: String(lng), addressdetails: "1" }
  );
  if (!res) return null;

  const data = (await res.json()) as {
    display_name?: string;
    error?: string;
    address?: {
      city?: string;
      town?: string;
      village?: string;
      hamlet?: string;
      suburb?: string;
      borough?: string;
      county?: string;
      state_district?: string;
      state?: string;
      region?: string;
      country?: string;
    };
  };
  if (!data || data.error) return null;

  const address = data.address ?? {};
  const location =
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.suburb ||
    address.borough ||
    address.county ||
    address.state_district ||
    address.state ||
    address.region ||
    address.country;
  if (!location) return null;

  return { location, country: address.country ?? null, displayName: data.display_name ?? location };
}
