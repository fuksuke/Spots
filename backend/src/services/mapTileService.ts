import * as tilebelt from "@mapbox/tilebelt";
import { Timestamp } from "firebase-admin/firestore";
import { LRUCache } from "lru-cache";
import Supercluster, { type AnyProps, type ClusterFeature, type PointFeature } from "supercluster";

import type { SpotCategory } from "../constants/categories.js";

import { firestore } from "./firebaseAdmin.js";

export type MapTileLayer = "cluster" | "pulse" | "balloon";

export type MapTileRequestOptions = {
  layer?: MapTileLayer;
  categories?: SpotCategory[];
  viewerId?: string;
  premiumOnly?: boolean;
  since?: number;
};

export type MapTileFeature = {
  id: string;
  type: MapTileLayer | "cluster";
  geometry: {
    lat: number;
    lng: number;
  };
  count?: number;
  popularity?: number;
  premium?: boolean;
  status?: "upcoming" | "live" | "ended";
  spot?: {
    title: string;
    category: SpotCategory;
    startTime: string;
    endTime: string;
    ownerId: string;
    ownerPhoneVerified?: boolean;
    likes?: number;
    commentsCount?: number;
    promotion?: {
      id: string;
      priority: number;
    } | null;
  };
};

export type MapTileResponse = {
  z: number;
  x: number;
  y: number;
  generatedAt: number;
  nextSyncAt: number;
  domBudget: number;
  features: MapTileFeature[];
};

export type TileCoordinate = {
  z: number;
  x: number;
  y: number;
};

type TileCacheKey = `${number}/${number}/${number}`;

type SpotDocumentLite = {
  id: string;
  title: string;
  category: SpotCategory;
  lat: number;
  lng: number;
  startTime: string;
  endTime: string;
  ownerId: string;
  likes: number;
  commentsCount: number;
  premium?: boolean;
};

type TileComputation = {
  generatedAt: number;
  features: MapTileFeature[];
};

type ClusterProps = {
  cluster: true;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated: string | number;
};

const MIN_ZOOM = 5;
const MAX_ZOOM = 20;
const MAX_TILE_RESULTS = 2000;
const DOM_BUDGET = 300;
const DEFAULT_NEXT_SYNC_MS = 60 * 1000;

const tileCache = new LRUCache<TileCacheKey, TileComputation>({
  max: 100,
  ttl: 60 * 1000
});

const clampZoom = (zoom: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(zoom)));

const makeCacheKey = ({ z, x, y }: TileCoordinate): TileCacheKey => `${z}/${x}/${y}`;

const isClusterProperties = (props: unknown): props is ClusterProps & AnyProps => {
  if (!props || typeof props !== "object") return false;
  return (props as ClusterProps).cluster === true;
};

const computeSpotStatus = (startIso: string, endIso: string): "upcoming" | "live" | "ended" => {
  const now = Date.now();
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return "upcoming";
  }
  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "live";
};

const resolveLayer = (requested: MapTileLayer | undefined, zoom: number, density: number): MapTileLayer => {
  if (requested) return requested;
  if (density > 1000 || zoom <= 8) return "cluster";
  if (density > 300) return "cluster";
  if (zoom <= 12) return "pulse";
  return "balloon";
};

const toTileCoordinate = (z: number, x: number, y: number): TileCoordinate => ({
  z: clampZoom(z),
  x: Math.max(0, Math.floor(x)),
  y: Math.max(0, Math.floor(y))
});

const toSpotLite = (doc: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>): SpotDocumentLite | null => {
  const data = doc.data();
  if (!data) return null;

  return {
    id: doc.id,
    title: String(data.title ?? ""),
    category: data.category as SpotCategory,
    lat: typeof data.lat === "number" ? data.lat : Number(data.lat),
    lng: typeof data.lng === "number" ? data.lng : Number(data.lng),
    startTime: data.start_time instanceof Timestamp ? data.start_time.toDate().toISOString() : String(data.start_time ?? ""),
    endTime: data.end_time instanceof Timestamp ? data.end_time.toDate().toISOString() : String(data.end_time ?? ""),
    ownerId: String(data.owner_id ?? ""),
    likes: typeof data.likes === "number" ? data.likes : 0,
    commentsCount: typeof data.comments_count === "number" ? data.comments_count : 0,
    premium: Boolean(data.premium)
  };
};

const enrichOwnerMetadata = async (spots: SpotDocumentLite[]) => {
  const ownerIds = Array.from(new Set(spots.map((spot) => spot.ownerId))).filter(Boolean);
  if (ownerIds.length === 0) return new Map<string, { phoneVerified: boolean }>();

  const ownerDocs = ownerIds.map((id) => firestore.collection("users").doc(id));
  const snapshots = await firestore.getAll(...ownerDocs);
  const map = new Map<string, { phoneVerified: boolean }>();
  snapshots.forEach((snap) => {
    const data = snap.data() as { phone_verified?: boolean } | undefined;
    if (snap.exists) {
      map.set(snap.id, { phoneVerified: Boolean(data?.phone_verified) });
    }
  });
  return map;
};

const buildSupercluster = (spots: SpotDocumentLite[]) => {
  const index = new Supercluster<{ spot: SpotDocumentLite }, AnyProps>(
    {
      maxZoom: 18,
      minPoints: 3,
      radius: 60
    }
  );

  const points = spots.map((spot) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [spot.lng, spot.lat] },
    properties: { spot }
  }));

  index.load(points);
  return index;
};

export const getMapTile = async (
  zRaw: number,
  xRaw: number,
  yRaw: number,
  options: MapTileRequestOptions = {}
): Promise<MapTileResponse> => {
  const tile = toTileCoordinate(zRaw, xRaw, yRaw);
  const cacheKey = makeCacheKey(tile);
  const cached = options.since ? tileCache.get(cacheKey) : null;
  if (cached && cached.generatedAt >= (options.since ?? 0)) {
    return {
      z: tile.z,
      x: tile.x,
      y: tile.y,
      generatedAt: cached.generatedAt,
      nextSyncAt: cached.generatedAt + DEFAULT_NEXT_SYNC_MS,
      domBudget: DOM_BUDGET,
      features: cached.features
    };
  }

  const bbox = tilebelt.tileToBBOX([tile.x, tile.y, tile.z]);
  const [minLng, minLat, maxLng, maxLat] = bbox;

  let query: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = firestore
    .collection("spots")
    .where("lat", ">=", minLat)
    .where("lat", "<=", maxLat)
    .orderBy("lat")
    .limit(MAX_TILE_RESULTS);

  if (options.categories && options.categories.length > 0) {
    const limited = options.categories.slice(0, 10);
    query = query.where("category", "in", limited);
  }

  const snapshot = await query.get();
  const rawSpots = snapshot.docs
    .map((doc) => toSpotLite(doc))
    .filter((spot): spot is SpotDocumentLite => Boolean(spot))
    .filter((spot) => spot.lng >= minLng && spot.lng <= maxLng);

  const filteredSpots = options.premiumOnly ? rawSpots.filter((spot) => spot.premium) : rawSpots;
  const density = filteredSpots.length;
  const resolvedLayer = resolveLayer(options.layer, tile.z, density);

  if (density === MAX_TILE_RESULTS) {
    console.warn("map tile result hit limit", { tile, density });
  }

  if (filteredSpots.length === 0) {
    const emptyResponse: MapTileResponse = {
      z: tile.z,
      x: tile.x,
      y: tile.y,
      generatedAt: Date.now(),
      nextSyncAt: Date.now() + DEFAULT_NEXT_SYNC_MS,
      domBudget: DOM_BUDGET,
      features: []
    };
    tileCache.set(cacheKey, { generatedAt: emptyResponse.generatedAt, features: [] });
    return emptyResponse;
  }

  const ownerMetadata = await enrichOwnerMetadata(filteredSpots);
  const clusterIndex = buildSupercluster(filteredSpots);
  const clusters = clusterIndex.getClusters([minLng, minLat, maxLng, maxLat], tile.z) as Array<
    ClusterFeature<AnyProps> | PointFeature<{ spot: SpotDocumentLite }>
  >;

  const features: MapTileFeature[] = clusters.map((feature) => {
    const { properties, geometry } = feature;
    const [lng, lat] = geometry.coordinates as [number, number];

    if (isClusterProperties(properties)) {
      const count = properties.point_count;
      const id = String(properties.cluster_id ?? `${tile.z}-${lat}-${lng}`);
      return {
        id,
        type: "cluster",
        geometry: { lat, lng },
        count,
        popularity:
          typeof properties.point_count_abbreviated === "number"
            ? properties.point_count_abbreviated
            : undefined
      } satisfies MapTileFeature;
    }

    const spot: SpotDocumentLite | undefined = (properties as { spot?: SpotDocumentLite } | undefined)?.spot;
    if (!spot) {
      return {
        id: `${tile.z}-${lat}-${lng}`,
        type: resolvedLayer,
        geometry: { lat, lng }
      } satisfies MapTileFeature;
    }

    const ownerMeta = spot.ownerId ? ownerMetadata.get(spot.ownerId) : undefined;

    return {
      id: spot.id,
      type: resolvedLayer,
      geometry: { lat, lng },
      popularity: spot.likes,
      premium: Boolean(spot.premium),
      status: computeSpotStatus(spot.startTime, spot.endTime),
      spot: {
        title: spot.title,
        category: spot.category,
        startTime: spot.startTime,
        endTime: spot.endTime,
        ownerId: spot.ownerId,
        ownerPhoneVerified: ownerMeta?.phoneVerified ?? false,
        likes: spot.likes,
        commentsCount: spot.commentsCount,
        promotion: null
      }
    } satisfies MapTileFeature;
  });

  const generatedAt = Date.now();
  const response: MapTileResponse = {
    z: tile.z,
    x: tile.x,
    y: tile.y,
    generatedAt,
    nextSyncAt: generatedAt + DEFAULT_NEXT_SYNC_MS,
    domBudget: DOM_BUDGET,
    features
  };

  tileCache.set(cacheKey, { generatedAt, features });

  return response;
};

export const clearMapTileCache = () => {
  tileCache.clear();
};
