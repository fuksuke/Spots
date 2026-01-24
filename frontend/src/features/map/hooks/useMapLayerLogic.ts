import { MutableRefObject, useEffect, useRef, useCallback } from "react";
import mapboxgl, { Map as MapboxMap } from "mapbox-gl";
import type { Feature, FeatureCollection, Point } from "geojson";
import { parseLocalTimestamp } from "../../../lib/map/time";
import { prefetchChildTiles, cancelPrefetch } from "../../../lib/mapTileApi";
import {
    MapTileFeature,
    MapTileLayer,
    MapTileResponse,
    SpotCategory,
    TileCoordinate
} from "../../../types";

const TILE_SOURCE_ID = "map-tiles-source";
const LAYER_CLUSTER = "map-tiles-layer-cluster";
const LAYER_CLUSTER_LABEL = "map-tiles-layer-cluster-label";
const LAYER_PULSE = "map-tiles-layer-pulse";
// const LAYER_BALLOON = "map-tiles-layer-balloon"; // Not used in this file but part of layer system

const MIN_ZOOM = 5;
const MAX_ZOOM = 20;
const GRID_MAX_ZOOM = 9;

// DOM budget constants (can be passed or imported)
const BASE_DOM_BUDGET = 300;
const resolveDomBudget = () => {
    if (typeof window === "undefined") return BASE_DOM_BUDGET;
    const dpr = window.devicePixelRatio || 1;
    const ua = window.navigator.userAgent.toLowerCase();
    let budget = BASE_DOM_BUDGET;
    if (/iphone|android/.test(ua)) {
        budget = dpr > 2 ? 260 : 220;
    } else if (/ipad|tablet/.test(ua)) {
        budget = 280;
    }
    return Math.max(180, Math.min(budget, BASE_DOM_BUDGET));
};
export const DOM_BUDGET = resolveDomBudget();

const EMPTY_GEOJSON: FeatureCollection<Point, FeatureProperties> = {
    type: "FeatureCollection",
    features: []
};

type FeatureProperties = {
    featureType: "cluster" | MapTileLayer;
    spotId?: string;
    title?: string;
    category?: SpotCategory;
    count?: number;
    premium?: boolean;
    status?: "upcoming" | "live" | "ended";
    popularity?: number;
};

const CATEGORY_COLORS: Record<SpotCategory, string> = {
    live: "#ef4444",
    event: "#f59e0b",
    cafe: "#10b981",
    coupon: "#8b5cf6",
    sports: "#3b82f6"
};

const normalizeTileIndex = (value: number, tileCount: number) => ((value % tileCount) + tileCount) % tileCount;

const coordinateKey = ({ z, x, y }: TileCoordinate) => `${z}/${x}/${y}`;

export const getVisibleTiles = (map: MapboxMap, buffer = 1): TileCoordinate[] => {
    const zoom = Math.floor(map.getZoom());
    const tileCount = 1 << zoom;
    const bounds = map.getBounds();

    if (!bounds) return [];

    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    // Convert lat/lng to tile coordinates
    const getX = (lng: number) => Math.floor((lng + 180) / 360 * tileCount);
    const getY = (lat: number) => Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * tileCount);

    const minX = getX(sw.lng) - buffer;
    const maxX = getX(ne.lng) + buffer;
    const minY = Math.max(0, getY(ne.lat) - buffer);
    const maxY = Math.min(tileCount - 1, getY(sw.lat) + buffer);

    const tiles: TileCoordinate[] = [];
    for (let x = minX; x <= maxX; x++) {
        const wrappedX = normalizeTileIndex(x, tileCount);
        for (let y = minY; y <= maxY; y++) {
            tiles.push({ z: zoom, x: wrappedX, y });
        }
    }

    const unique = new Map<string, TileCoordinate>();
    tiles.forEach((tile) => {
        unique.set(coordinateKey(tile), tile);
    });
    return Array.from(unique.values());
};

type RenderingData = {
    featureCollection: FeatureCollection<Point, FeatureProperties>;
    calloutCandidates: MapTileFeature[];
    nonClusterCount: number;
    premiumCount: number;
    spotFeatures: MapTileFeature[];
};

export const buildRenderingData = (tiles: MapTileResponse[]): RenderingData => {
    if (!tiles || tiles.length === 0) {
        return {
            featureCollection: EMPTY_GEOJSON,
            calloutCandidates: [],
            nonClusterCount: 0,
            premiumCount: 0,
            spotFeatures: []
        };
    }

    const clusterFeatures: MapTileFeature[] = [];
    const spotFeatures: MapTileFeature[] = [];
    const now = Date.now();

    tiles.forEach((tile) => {
        tile.features?.forEach((feature) => {
            if (feature.type === "cluster") {
                clusterFeatures.push(feature);
            } else if (feature.id) {
                if (feature.spot?.endTime) {
                    const endTime = parseLocalTimestamp(feature.spot.endTime);
                    if (endTime !== null && endTime <= now) return;
                }
                spotFeatures.push(feature);
            }
        });
    });

    const uniqueSpotMap = new Map<string, MapTileFeature>();
    spotFeatures.forEach((feature) => {
        if (!uniqueSpotMap.has(feature.id)) {
            uniqueSpotMap.set(feature.id, feature);
        }
    });

    const uniqueSpots = Array.from(uniqueSpotMap.values());
    const premiumSpots = uniqueSpots.filter((feature) => Boolean(feature.premium));
    const premiumSet = new Set(premiumSpots.map((feature) => feature.id));
    const regularSpots = uniqueSpots.filter((feature) => !premiumSet.has(feature.id));

    const remainingBudget = Math.max(0, DOM_BUDGET - premiumSpots.length);
    const limitedRegular = regularSpots.slice(0, remainingBudget);
    const limitedSpotFeatures = [...premiumSpots, ...limitedRegular];

    const clusterMap = new Map<string, MapTileFeature>();
    clusterFeatures.forEach((feature) => {
        const clusterId = feature.id ?? `${feature.geometry.lng}:${feature.geometry.lat}`;
        if (!clusterMap.has(clusterId)) {
            clusterMap.set(clusterId, feature);
        }
    });

    const features: Array<Feature<Point, FeatureProperties>> = [];

    clusterMap.forEach((feature) => {
        features.push({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [feature.geometry.lng, feature.geometry.lat]
            },
            properties: {
                featureType: "cluster",
                count: feature.count ?? 0,
                popularity: feature.popularity ?? 0
            }
        });
    });

    limitedSpotFeatures.forEach((feature) => {
        features.push({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [feature.geometry.lng, feature.geometry.lat]
            },
            properties: {
                featureType: feature.type,
                spotId: feature.id,
                title: feature.spot?.ownerDisplayName ?? feature.spot?.title ?? feature.spot?.ownerId ?? "",
                category: feature.spot?.category,
                premium: Boolean(feature.premium),
                status: feature.status,
                popularity: feature.popularity ?? 0
            }
        });
    });

    const calloutCandidates = limitedSpotFeatures.filter((feature) => feature.type === "balloon");

    return {
        featureCollection: {
            type: "FeatureCollection",
            features
        },
        calloutCandidates,
        nonClusterCount: uniqueSpots.length,
        premiumCount: premiumSpots.length,
        spotFeatures: uniqueSpots
    };
};

export const ensureMapLayers = (map: MapboxMap) => {
    if (!map.getSource(TILE_SOURCE_ID)) {
        map.addSource(TILE_SOURCE_ID, {
            type: "geojson",
            data: EMPTY_GEOJSON
        });
    }
    if (!map.getLayer(LAYER_CLUSTER)) {
        map.addLayer({
            id: LAYER_CLUSTER,
            type: "circle",
            source: TILE_SOURCE_ID,
            filter: ["==", ["get", "featureType"], "cluster"],
            paint: {
                "circle-color": "#1d4ed8",
                "circle-radius": ["interpolate", ["linear"], ["get", "count"], 1, 18, 200, 36],
                "circle-opacity": 0.75
            }
        });
    }

    if (!map.getLayer(LAYER_CLUSTER_LABEL)) {
        map.addLayer({
            id: LAYER_CLUSTER_LABEL,
            type: "symbol",
            source: TILE_SOURCE_ID,
            filter: ["==", ["get", "featureType"], "cluster"],
            layout: {
                "text-field": ["to-string", ["get", "count"]],
                "text-size": 14
            },
            paint: {
                "text-color": "#ffffff"
            }
        });
    }

    if (!map.getLayer(LAYER_PULSE)) {
        map.addLayer({
            id: LAYER_PULSE,
            type: "circle",
            source: TILE_SOURCE_ID,
            filter: [
                "match",
                ["get", "featureType"],
                "pulse",
                true,
                "balloon",
                true,
                false
            ],
            paint: {
                "circle-color": [
                    "match",
                    ["get", "category"],
                    "live",
                    CATEGORY_COLORS.live,
                    "event",
                    CATEGORY_COLORS.event,
                    "cafe",
                    CATEGORY_COLORS.cafe,
                    "coupon",
                    CATEGORY_COLORS.coupon,
                    "sports",
                    CATEGORY_COLORS.sports,
                    "#6366f1"
                ],
                "circle-radius": [
                    "interpolate",
                    ["exponential", 1.6],
                    ["zoom"],
                    8,
                    0,
                    9.2,
                    2.6,
                    10.5,
                    4.8,
                    12.5,
                    7.5
                ],
                "circle-stroke-width": [
                    "interpolate",
                    ["exponential", 1.6],
                    ["zoom"],
                    8,
                    0,
                    9.2,
                    0.45,
                    10.5,
                    0.7,
                    12.5,
                    1.15
                ],
                "circle-stroke-color": "#ffffff",
                "circle-opacity": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    8,
                    0,
                    9.2,
                    0.16,
                    10.5,
                    0.65,
                    12.5,
                    0.88
                ]
            }
        });
    }
};

const clampZoom = (zoom: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(zoom)));

export const deriveLayerForZoom = (zoom: number): MapTileLayer => {
    const clamped = clampZoom(zoom);
    if (clamped <= GRID_MAX_ZOOM) return "cluster";
    if (clamped <= 12) return "pulse";
    return "balloon";
};

type TileWatcherParams = {
    mapRef: MutableRefObject<MapboxMap | null>;
    isLayerOverridden: boolean;
    tileLayer?: MapTileLayer;
    onTilesChange: (tiles: TileCoordinate[]) => void;
    onActiveLayerChange: (layer: MapTileLayer | undefined) => void;
};

export const useMapTileWatcher = ({
    mapRef,
    isLayerOverridden,
    tileLayer,
    onTilesChange,
    onActiveLayerChange
}: TileWatcherParams) => {
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const updateTiles = () => {
            onTilesChange(getVisibleTiles(map));
            if (!isLayerOverridden) {
                onActiveLayerChange(deriveLayerForZoom(map.getZoom()));
            } else if (tileLayer) {
                onActiveLayerChange(tileLayer);
            }
        };

        updateTiles();
        map.on("moveend", updateTiles);
        map.on("zoomend", updateTiles);

        return () => {
            map.off("moveend", updateTiles);
            map.off("zoomend", updateTiles);
        };
    }, [isLayerOverridden, mapRef, onActiveLayerChange, onTilesChange, tileLayer]);
};

// Prefetch threshold: trigger when zoom is within 0.3 of next level
const PREFETCH_ZOOM_THRESHOLD = 0.3;

type ZoomPrefetchParams = {
    mapRef: MutableRefObject<MapboxMap | null>;
    currentTiles: TileCoordinate[];
    layer?: MapTileLayer;
    categories?: SpotCategory[];
    premiumOnly?: boolean;
    authToken?: string;
    enabled?: boolean;
};

export const useZoomPrefetch = ({
    mapRef,
    currentTiles,
    layer,
    categories,
    premiumOnly,
    authToken,
    enabled = true
}: ZoomPrefetchParams) => {
    const lastPrefetchZoomRef = useRef<number | null>(null);
    const isPrefetchingRef = useRef(false);

    const triggerPrefetch = useCallback(
        (zoom: number, tiles: TileCoordinate[]) => {
            if (!enabled || tiles.length === 0 || isPrefetchingRef.current) {
                return;
            }

            const nextZoom = Math.floor(zoom) + 1;
            const distanceToNext = nextZoom - zoom;

            // Only prefetch when close to next zoom level and zooming in
            if (distanceToNext > PREFETCH_ZOOM_THRESHOLD) {
                return;
            }

            // Avoid re-prefetching for the same zoom level
            if (lastPrefetchZoomRef.current === nextZoom) {
                return;
            }

            lastPrefetchZoomRef.current = nextZoom;
            isPrefetchingRef.current = true;

            prefetchChildTiles(tiles, {
                layer,
                categories,
                premiumOnly,
                authToken
            }).finally(() => {
                isPrefetchingRef.current = false;
            });
        },
        [enabled, layer, categories, premiumOnly, authToken]
    );

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !enabled) {
            return;
        }

        const handleZoom = () => {
            const zoom = map.getZoom();
            triggerPrefetch(zoom, currentTiles);
        };

        map.on("zoom", handleZoom);

        return () => {
            map.off("zoom", handleZoom);
            cancelPrefetch();
        };
    }, [mapRef, currentTiles, enabled, triggerPrefetch]);

    // Reset prefetch state when tiles change significantly
    useEffect(() => {
        lastPrefetchZoomRef.current = null;
    }, [currentTiles.length]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cancelPrefetch();
        };
    }, []);
};
