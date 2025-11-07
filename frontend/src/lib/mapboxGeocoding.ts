const MAPBOX_GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

export type GeocodingFeature = {
  id: string;
  place_name: string;
  center: [number, number];
};

export type GeocodingResponse = {
  features: GeocodingFeature[];
};

export const searchPlaces = async (query: string, signal?: AbortSignal): Promise<GeocodingFeature[]> => {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token) {
    throw new Error("Mapbox token is not configured");
  }

  const url = new URL(`${MAPBOX_GEOCODING_URL}/${encodeURIComponent(query)}.json`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("language", "ja");
  url.searchParams.set("limit", "5");

  const response = await fetch(url.toString(), { signal });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Geocoding failed with status ${response.status}`);
  }

  const data = (await response.json()) as GeocodingResponse;
  return data.features ?? [];
};
