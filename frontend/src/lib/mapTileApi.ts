import type {
  BatchTileRequest,
  BatchTileResponse,
  MapTileDiff,
  MapTileFeature,
  MapTileLayer,
  MapTileResponse,
  SpotCategory,
  TileCoordinate
} from "../types";
import { mapTileCache } from "./mapTileCache";
import { buildMockTileResponse, buildMockTileResponses } from "../mockData";

const coordinateKey = ({ z, x, y }: TileCoordinate) => `${z}/${x}/${y}`;
const MAX_BATCH_SIZE = 16;

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
  etag?: string;
};

export type FetchMapTilesBatchOptions = {
  layer?: MapTileLayer;
  categories?: SpotCategory[];
  premiumOnly?: boolean;
  authToken?: string;
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
  const { layer, categories, premiumOnly, authToken, signal, previous, etag } = options;
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

  const headers: Record<string, string> = {};
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  if (etag) {
    headers["If-None-Match"] = etag;
  }

  const response = await fetch(requestPath, {
    method: "GET",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    signal
  });

  // Handle 304 Not Modified - return cached data
  if (response.status === 304 && previous) {
    if (startedAt !== undefined && typeof console !== "undefined" && typeof console.debug === "function") {
      const duration = Math.round(performance.now() - startedAt);
      console.debug("mapTileFetch", {
        tile: coordinateKey(coordinate),
        duration,
        notModified: true
      });
    }
    return previous;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch map tile (${response.status})`);
  }

  const payload = (await response.json()) as MapTileResponse & { diffs?: MapTileDiff[]; etag?: string };
  const { diffs, etag: responseEtag, ...rest } = payload;

  let features = rest.features ?? previous?.features ?? [];
  if (diffs && previous) {
    features = applyDiffs(previous, diffs);
  }

  const resolved: MapTileResponse = {
    ...rest,
    features
  };

  await mapTileCache.set(coordinate, resolved, responseEtag);

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

export const fetchMapTilesBatch = async (
  coordinates: TileCoordinate[],
  options: FetchMapTilesBatchOptions = {}
): Promise<MapTileResponse[]> => {
  const { layer, categories, premiumOnly, authToken, signal } = options;

  if (coordinates.length === 0) {
    return [];
  }

  if (import.meta.env.VITE_USE_MOCK_TILES === 'true') {
    return buildMockTileResponses(coordinates, {
      layer,
      categories,
      premiumOnly
    });
  }

  // Get cached data and ETags for each coordinate
  const cachedData = await Promise.all(
    coordinates.map(async (coord) => {
      const cached = await mapTileCache.get(coord);
      const etag = await mapTileCache.getETag(coord);
      return { coord, cached, etag };
    })
  );

  const requestBody: BatchTileRequest = {
    tiles: cachedData.map(({ coord, cached, etag }) => ({
      z: coord.z,
      x: coord.x,
      y: coord.y,
      since: cached?.generatedAt,
      etag
    })),
    layer,
    categories,
    premiumOnly
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const startedAt = typeof performance !== "undefined" ? performance.now() : undefined;

  const response = await fetch("/api/map/tiles/batch", {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
    signal
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch map tiles batch (${response.status})`);
  }

  const batchResponse = (await response.json()) as BatchTileResponse;

  const results = await Promise.all(
    batchResponse.tiles.map(async (tileResponse, index) => {
      const { coord, cached } = cachedData[index];

      // If notModified, use cached data
      if (tileResponse.notModified && cached) {
        return cached;
      }

      const resolved: MapTileResponse = {
        z: tileResponse.z,
        x: tileResponse.x,
        y: tileResponse.y,
        generatedAt: tileResponse.generatedAt,
        nextSyncAt: tileResponse.nextSyncAt,
        domBudget: tileResponse.domBudget,
        features: tileResponse.features
      };

      await mapTileCache.set(coord, resolved, tileResponse.etag);
      return resolved;
    })
  );

  if (startedAt !== undefined && typeof console !== "undefined" && typeof console.debug === "function") {
    const duration = Math.round(performance.now() - startedAt);
    const notModifiedCount = batchResponse.tiles.filter((t) => t.notModified).length;
    console.debug("mapTileBatchFetch", {
      count: coordinates.length,
      notModified: notModifiedCount,
      duration
    });
  }

  return results;
};

// Prefetch state management
let prefetchAbortController: AbortController | null = null;
let prefetchIdleCallbackId: number | null = null;

/**
 * Get the 4 child tiles for a parent tile (used when zooming in)
 */
export const getChildTiles = (parent: TileCoordinate): TileCoordinate[] => {
  const childZ = parent.z + 1;
  const childX = parent.x * 2;
  const childY = parent.y * 2;

  return [
    { z: childZ, x: childX, y: childY },
    { z: childZ, x: childX + 1, y: childY },
    { z: childZ, x: childX, y: childY + 1 },
    { z: childZ, x: childX + 1, y: childY + 1 }
  ];
};

/**
 * Get all child tiles for multiple parent tiles
 */
export const getChildTilesForParents = (parents: TileCoordinate[]): TileCoordinate[] => {
  const children: TileCoordinate[] = [];
  const seen = new Set<string>();

  for (const parent of parents) {
    for (const child of getChildTiles(parent)) {
      const key = coordinateKey(child);
      if (!seen.has(key)) {
        seen.add(key);
        children.push(child);
      }
    }
  }

  return children;
};

export type PrefetchOptions = {
  layer?: MapTileLayer;
  categories?: SpotCategory[];
  premiumOnly?: boolean;
  authToken?: string;
};

/**
 * Prefetch child tiles in the background using requestIdleCallback.
 * Automatically skips tiles that are already cached.
 */
export const prefetchChildTiles = async (
  parentTiles: TileCoordinate[],
  options: PrefetchOptions = {}
): Promise<void> => {
  // Cancel any existing prefetch
  cancelPrefetch();

  const childTiles = getChildTilesForParents(parentTiles);

  if (childTiles.length === 0) {
    return;
  }

  // Filter out already cached tiles
  const uncachedTiles: TileCoordinate[] = [];
  for (const tile of childTiles) {
    const isCached = await mapTileCache.has(tile);
    if (!isCached) {
      uncachedTiles.push(tile);
    }
  }

  if (uncachedTiles.length === 0) {
    console.debug("prefetchChildTiles: all tiles already cached");
    return;
  }

  // Limit to MAX_BATCH_SIZE
  const tilesToFetch = uncachedTiles.slice(0, MAX_BATCH_SIZE);

  prefetchAbortController = new AbortController();
  const controller = prefetchAbortController;

  const doPrefetch = async () => {
    if (controller.signal.aborted) {
      return;
    }

    try {
      const startedAt = performance.now();

      await fetchMapTilesBatch(tilesToFetch, {
        layer: options.layer,
        categories: options.categories,
        premiumOnly: options.premiumOnly,
        authToken: options.authToken,
        signal: controller.signal
      });

      if (!controller.signal.aborted) {
        const duration = Math.round(performance.now() - startedAt);
        console.debug("prefetchChildTiles", {
          count: tilesToFetch.length,
          duration
        });
      }
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") {
        console.debug("prefetchChildTiles failed", error);
      }
    }
  };

  // Use requestIdleCallback for background execution
  if (typeof requestIdleCallback !== "undefined") {
    prefetchIdleCallbackId = requestIdleCallback(
      () => {
        prefetchIdleCallbackId = null;
        void doPrefetch();
      },
      { timeout: 2000 }
    );
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => void doPrefetch(), 100);
  }
};

/**
 * Cancel any pending prefetch operations
 */
export const cancelPrefetch = (): void => {
  if (prefetchIdleCallbackId !== null) {
    if (typeof cancelIdleCallback !== "undefined") {
      cancelIdleCallback(prefetchIdleCallbackId);
    }
    prefetchIdleCallbackId = null;
  }

  if (prefetchAbortController) {
    prefetchAbortController.abort();
    prefetchAbortController = null;
  }
};
