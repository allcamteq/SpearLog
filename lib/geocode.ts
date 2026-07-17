export type GeocodeResult = {
  lat: number;
  lng: number;
  displayName: string;
  country: string | null;
};

async function queryNominatim(query: string): Promise<GeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
    addressdetails: "1",
  })}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "SpearLog/1.0 (personal spearfishing log; contact via app owner)",
    },
  });

  if (!res.ok) return null;

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
 * Geocodes a free-text location (+ optional country) into coordinates via
 * Nominatim (OpenStreetMap) — free, no API key. Per Nominatim's usage policy
 * a descriptive User-Agent is required and requests should be infrequent
 * (fine here since this only runs on an explicit user button click/blur).
 *
 * Tries the location on its own first — appending country when the location
 * text already names it (e.g. "Plymouth, UK" + country "United Kingdom")
 * produces a query Nominatim often can't resolve. Country is only appended
 * as a fallback disambiguation attempt if the plain query comes up empty.
 */
export async function geocodeLocation(location: string, country?: string | null): Promise<GeocodeResult | null> {
  const direct = await queryNominatim(location);
  if (direct) return direct;

  if (country && !location.toLowerCase().includes(country.toLowerCase())) {
    return queryNominatim(`${location}, ${country}`);
  }

  return null;
}

export type ReverseGeocodeResult = {
  location: string;
  country: string | null;
  displayName: string;
};

/**
 * Reverse-geocodes a coordinate to a place name via Nominatim — picks the most
 * "town/city"-sized address component, falling back to progressively broader
 * ones (county, then state/region, then country) so a remote mark still
 * resolves to something usable. Marks well offshore often have no town/county
 * match at all — only a country via its territorial-waters boundary — so the
 * fallback chain has to reach all the way to `country` or those marks would
 * come back as unresolvable even though Nominatim did find something.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?${new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: "json",
    addressdetails: "1",
  })}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "SpearLog/1.0 (personal spearfishing log; contact via app owner)",
    },
  });

  if (!res.ok) return null;

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
