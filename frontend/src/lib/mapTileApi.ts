import type { MapTileLayer, MapTileResponse, SpotCategory, TileCoordinate } from "../types";
import { mapTileCache } from "./mapTileCache";

export type FetchMapTileOptions = {
  layer?: MapTileLayer;
  categories?: SpotCategory[];
  premiumOnly?: boolean;
  authToken?: string;
  since?: number;
  signal?: AbortSignal;
};

const serializeCategories = (categories: SpotCategory[] | undefined) => {
  if (!categories || categories.length === 0) return undefined;
  return categories.join(",");
};

export const fetchMapTile = async (
  coordinate: TileCoordinate,
  options: FetchMapTileOptions = {}
): Promise<MapTileResponse> => {
  const { layer, categories, premiumOnly, since, authToken, signal } = options;

  const cached = await mapTileCache.get(coordinate, since);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams();
  if (layer) params.set("layer", layer);
  const serializedCategories = serializeCategories(categories);
  if (serializedCategories) params.set("categories", serializedCategories);
  if (typeof premiumOnly === "boolean") {
    params.set("premiumOnly", String(premiumOnly));
  }
  if (typeof since === "number" && Number.isFinite(since)) {
    params.set("since", String(since));
  }

  const requestPath = `/api/map/tiles/${coordinate.z}/${coordinate.x}/${coordinate.y}${params.size ? `?${params.toString()}` : ""}`;

  const response = await fetch(requestPath, {
    method: "GET",
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    signal
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch map tile (${response.status})`);
  }

  const payload = (await response.json()) as MapTileResponse;
  await mapTileCache.set(coordinate, payload);
  return payload;
};
