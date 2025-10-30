import type {
  MapTileDiff,
  MapTileFeature,
  MapTileLayer,
  MapTileResponse,
  SpotCategory,
  TileCoordinate
} from "../types";
import { mapTileCache } from "./mapTileCache";
import { buildMockTileResponse } from "../mockData";

const coordinateKey = ({ z, x, y }: TileCoordinate) => `${z}/${x}/${y}`;

const applyDiffs = (previous: MapTileResponse, diffs: MapTileDiff[]): MapTileFeature[] => {
  const featureMap = new Map(previous.features?.map((feature) => [feature.id, feature]) ?? []);
  diffs.forEach((diff) => {
    if (diff.op === "upsert" && diff.feature) {
      featureMap.set(diff.id, diff.feature);
    } else if (diff.op === "delete") {
      featureMap.delete(diff.id);
    }
  });
  return Array.from(featureMap.values());
};

export type FetchMapTileOptions = {
  layer?: MapTileLayer;
  categories?: SpotCategory[];
  premiumOnly?: boolean;
  authToken?: string;
  since?: number;
  previous?: MapTileResponse;
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
  const { layer, categories, premiumOnly, authToken, signal, previous } = options;
  const since = options.since ?? previous?.generatedAt;

  if (import.meta.env.VITE_USE_MOCK_TILES === 'true') {
    return buildMockTileResponse(coordinate, {
      layer,
      categories,
      premiumOnly
    });
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
  const startedAt = typeof performance !== "undefined" ? performance.now() : undefined;

  const response = await fetch(requestPath, {
    method: "GET",
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
    signal
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch map tile (${response.status})`);
  }

  const payload = (await response.json()) as MapTileResponse & { diffs?: MapTileDiff[] };
  const { diffs, ...rest } = payload;

  let features = rest.features ?? previous?.features ?? [];
  if (diffs && previous) {
    features = applyDiffs(previous, diffs);
  }

  const resolved: MapTileResponse = {
    ...rest,
    features
  };

  await mapTileCache.set(coordinate, resolved);

  if (startedAt !== undefined && typeof console !== "undefined" && typeof console.debug === "function") {
    const duration = Math.round(performance.now() - startedAt);
    console.debug("mapTileFetch", {
      tile: coordinateKey(coordinate),
      duration,
      diff: Boolean(diffs),
      cached: Boolean(previous)
    });
  }

  return resolved;
};
