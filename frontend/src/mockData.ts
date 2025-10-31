import spots from "./mocks/spots-base.json";

import type {
  MapTileLayer,
  MapTileResponse,
  Spot,
  SpotCategory,
  TileCoordinate
} from "./types";

const DOM_BUDGET = 300;
const SYNC_INTERVAL_MS = 60_000;

export const mockSpots = spots as Spot[];

export type BuildMockTileOptions = {
  layer?: MapTileLayer;
  categories?: SpotCategory[];
  premiumOnly?: boolean;
};

const deriveSpotLayer = (spot: Spot): MapTileLayer => {
  if (spot.defaultMapLayer) {
    return spot.defaultMapLayer;
  }
  if (spot.premium) {
    return "balloon";
  }
  return "pulse";
};

const resolveLayer = (spot: Spot, override?: MapTileLayer): MapTileLayer => {
  if (!override || override === "cluster") {
    return deriveSpotLayer(spot);
  }
  return override;
};

const filterSpots = (base: Spot[], { categories, premiumOnly }: BuildMockTileOptions = {}) => {
  return base.filter((spot) => {
    if (premiumOnly && !spot.premium) {
      return false;
    }
    if (categories && categories.length > 0 && !categories.includes(spot.category)) {
      return false;
    }
    return true;
  });
};

const createClusterFeature = (filteredSpots: Spot[]): MapTileResponse["features"][number] | null => {
  if (filteredSpots.length === 0) {
    return null;
  }

  const averageLat = filteredSpots.reduce((sum, spot) => sum + spot.lat, 0) / filteredSpots.length;
  const averageLng = filteredSpots.reduce((sum, spot) => sum + spot.lng, 0) / filteredSpots.length;
  const popularity = filteredSpots.reduce((sum, spot) => sum + (spot.popularityScore ?? 0), 0);

  return {
    id: "cluster-shibuya-core",
    type: "cluster",
    geometry: { lat: averageLat, lng: averageLng },
    count: filteredSpots.length,
    popularity
  };
};

const createSpotFeature = (spot: Spot, layer: MapTileLayer): MapTileResponse["features"][number] => {
  return {
    id: spot.id,
    type: layer,
    geometry: { lat: spot.lat, lng: spot.lng },
    premium: Boolean(spot.premium),
    status: spot.status,
    popularity: spot.popularityScore ?? spot.viewCount ?? spot.likes,
    spot: {
      title: spot.title,
      speechBubble: spot.speechBubble ?? spot.summary ?? spot.title,
      summary: spot.summary,
      category: spot.category,
      startTime: spot.startTime,
      endTime: spot.endTime,
      ownerId: spot.ownerId,
      ownerDisplayName: spot.ownerDisplayName ?? spot.ownerId,
      ownerPhoneVerified: spot.ownerPhoneVerified,
      likes: spot.likes,
      commentsCount: spot.commentsCount,
      promotion: spot.promotion ?? null
    }
  };
};

export const buildMockTileResponse = (
  coordinate: TileCoordinate,
  options: BuildMockTileOptions = {}
): MapTileResponse => {
  const filteredSpots = filterSpots(mockSpots, options);
  const { layer } = options;

  const features: MapTileResponse["features"] = [];

  if (layer === "cluster") {
    const clusterFeature = createClusterFeature(filteredSpots);
    if (clusterFeature) {
      features.push(clusterFeature);
    }
  } else {
    filteredSpots.forEach((spot) => {
      const featureLayer = resolveLayer(spot, layer);
      features.push(createSpotFeature(spot, featureLayer));
    });
  }

  const now = Date.now();

  return {
    z: coordinate.z,
    x: coordinate.x,
    y: coordinate.y,
    generatedAt: now,
    nextSyncAt: now + SYNC_INTERVAL_MS,
    domBudget: DOM_BUDGET,
    features
  };
};

export const buildMockTileResponses = (
  coordinates: TileCoordinate[],
  options: BuildMockTileOptions = {}
): MapTileResponse[] => coordinates.map((coordinate) => buildMockTileResponse(coordinate, options));
