import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { Map as MapboxMap } from "mapbox-gl";
import * as tilebelt from "@mapbox/tilebelt";
import type { Feature, FeatureCollection, Point } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";

import { useMapTiles } from "../hooks/useMapTiles";
import type {
  Coordinates,
  MapTileFeature,
  MapTileLayer,
  MapTileResponse,
  Spot,
  SpotCategory,
  TileCoordinate
} from "../types";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

const TILE_SOURCE_ID = "map-tiles-source";
const LAYER_CLUSTER = "map-tiles-layer-cluster";
const LAYER_CLUSTER_LABEL = "map-tiles-layer-cluster-label";
const LAYER_PULSE = "map-tiles-layer-pulse";
const LAYER_BALLOON = "map-tiles-layer-balloon";
const INTERACTIVE_LAYERS = [LAYER_BALLOON, LAYER_PULSE, LAYER_CLUSTER];

const MIN_ZOOM = 5;
const MAX_ZOOM = 20;

const EMPTY_GEOJSON: FeatureCollection<Point, FeatureProperties> = {
  type: "FeatureCollection",
  features: []
};

const clampZoom = (zoom: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.floor(zoom)));

const GLOBAL_DOM_BUDGET = 300;

const deriveLayerForZoom = (zoom: number): MapTileLayer => {
  const clamped = clampZoom(zoom);
  if (clamped <= 8) return "cluster";
  if (clamped <= 12) return "pulse";
  return "balloon";
};

const normalizeTileIndex = (value: number, tileCount: number) => ((value % tileCount) + tileCount) % tileCount;

const coordinateKey = ({ z, x, y }: TileCoordinate) => `${z}/${x}/${y}`;

const getVisibleTiles = (map: MapboxMap, buffer = 1): TileCoordinate[] => {
  const zoom = clampZoom(map.getZoom());
  const tileCount = 1 << zoom;
  const bounds = map.getBounds();
  if (!bounds) {
    return [];
  }

  const corners = [bounds.getNorthWest(), bounds.getNorthEast(), bounds.getSouthEast(), bounds.getSouthWest()];
  const cornerTiles = corners.map((corner) => tilebelt.pointToTile(corner.lng, corner.lat, zoom));

  let xs = cornerTiles.map(([x]) => x);
  const ys = cornerTiles.map(([, y]) => y);

  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  if (maxX - minX > tileCount / 2) {
    xs = xs.map((x) => (x < tileCount / 2 ? x + tileCount : x));
    minX = Math.min(...xs);
    maxX = Math.max(...xs);
  }

  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);

  minX = Math.floor(minX - buffer);
  maxX = Math.ceil(maxX + buffer);
  minY = Math.floor(minY - buffer);
  maxY = Math.ceil(maxY + buffer);

  const tiles: TileCoordinate[] = [];
  for (let x = minX; x <= maxX; x++) {
    const wrappedX = normalizeTileIndex(x, tileCount);
    for (let y = minY; y <= maxY; y++) {
      if (y < 0 || y >= tileCount) continue;
      tiles.push({ z: zoom, x: wrappedX, y });
    }
  }

  const unique = new Map<string, TileCoordinate>();
  tiles.forEach((tile) => {
    unique.set(coordinateKey(tile), tile);
  });
  return Array.from(unique.values());
};

const CATEGORY_COLORS: Record<SpotCategory, string> = {
  live: "#ef4444",
  event: "#f59e0b",
  cafe: "#10b981",
  coupon: "#8b5cf6",
  sports: "#3b82f6"
};

const buildFeatureCollection = (tiles: MapTileResponse[]): FeatureCollection<Point, FeatureProperties> => {
  if (!tiles || tiles.length === 0) {
    return EMPTY_GEOJSON;
  }

  const clusterFeatures: MapTileFeature[] = [];
  const spotFeatures: MapTileFeature[] = [];

  tiles.forEach((tile) => {
    tile.features?.forEach((feature) => {
      if (feature.type === "cluster") {
        clusterFeatures.push(feature);
      } else {
        spotFeatures.push(feature);
      }
    });
  });

  const clusterMap = new Map<string, MapTileFeature>();
  clusterFeatures.forEach((feature) => {
    const clusterId = feature.id ?? `${feature.geometry.lng}:${feature.geometry.lat}`;
    if (!clusterMap.has(clusterId)) {
      clusterMap.set(clusterId, feature);
    }
  });

  const spotMap = new Map<string, MapTileFeature>();
  spotFeatures.forEach((feature) => {
    if (!spotMap.has(feature.id)) {
      spotMap.set(feature.id, feature);
    }
  });

  const limitedSpotFeatures = Array.from(spotMap.values()).slice(0, GLOBAL_DOM_BUDGET);

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

  for (const feature of limitedSpotFeatures) {
    const properties: FeatureProperties = {
      featureType: feature.type,
      spotId: feature.id,
      title: feature.spot?.title ?? "",
      category: feature.spot?.category,
      premium: feature.premium ? 1 : 0,
      status: feature.status,
      popularity: feature.popularity ?? 0
    };

    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [feature.geometry.lng, feature.geometry.lat]
      },
      properties
    });
  }

  return {
    type: "FeatureCollection",
    features
  };
};

const ensureMapLayers = (map: MapboxMap) => {
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
      filter: ["==", ["get", "featureType"], "pulse"],
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
        "circle-radius": ["case", ["get", "premium"], 12, 9],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#0f172a",
        "circle-opacity": 0.85
      }
    });
  }

  if (!map.getLayer(LAYER_BALLOON)) {
    map.addLayer({
      id: LAYER_BALLOON,
      type: "symbol",
      source: TILE_SOURCE_ID,
      filter: ["==", ["get", "featureType"], "balloon"],
      layout: {
        "text-field": ["get", "title"],
        "text-anchor": "top",
        "text-offset": [0, 1.1],
        "text-size": 12,
        "icon-image": ["case", ["get", "premium"], "marker-15", "circle-15"],
        "icon-size": ["case", ["get", "premium"], 1.1, 0.9],
        "icon-allow-overlap": true
      },
      paint: {
        "text-color": "#111827",
        "text-halo-color": "rgba(255,255,255,0.8)",
        "text-halo-width": 1.5
      }
    });
  }
};

export type MapViewProps = {
  initialView: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  spots?: Spot[];
  selectedLocation?: Coordinates | null;
  onSelectLocation?: (coords: Coordinates) => void;
  focusCoordinates?: Coordinates | null;
  onSpotClick?: (spotId: string) => void;
  tileLayer?: MapTileLayer;
  tileCategories?: SpotCategory[];
  tilePremiumOnly?: boolean;
  authToken?: string;
};

type FeatureProperties = {
  featureType: "cluster" | MapTileLayer;
  spotId?: string;
  title?: string;
  category?: SpotCategory;
  count?: number;
  premium?: number;
  status?: "upcoming" | "live" | "ended";
  popularity?: number;
};

export const MapView = ({
  initialView,
  spots: legacySpots = [],
  selectedLocation,
  onSelectLocation,
  focusCoordinates,
  onSpotClick,
  tileLayer,
  tileCategories,
  tilePremiumOnly,
  authToken
}: MapViewProps) => {
  void legacySpots;

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const selectionMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const [tileCoordinates, setTileCoordinates] = useState<TileCoordinate[]>([]);
  const [activeLayer, setActiveLayer] = useState<MapTileLayer | undefined>(tileLayer);

  const categoriesKey = useMemo(() => (tileCategories ? tileCategories.join(",") : ""), [tileCategories]);

  useEffect(() => {
    if (tileLayer !== undefined) {
      setActiveLayer(tileLayer);
    }
  }, [tileLayer]);

  const { tiles, error: tilesError } = useMapTiles({
    coordinates: tileCoordinates,
    layer: tileLayer !== undefined ? tileLayer : activeLayer,
    categories: tileCategories,
    premiumOnly: tilePremiumOnly,
    authToken,
    enabled: tileCoordinates.length > 0
  });

  useEffect(() => {
    if (tilesError) {
      console.warn("Failed to load map tiles", tilesError);
    }
  }, [tilesError]);

  const isLayerOverridden = tileLayer !== undefined;

  useEffect(() => {
    if (isLayerOverridden && tileLayer !== undefined) {
      setActiveLayer(tileLayer);
    }
  }, [isLayerOverridden, tileLayer]);

  useEffect(() => {
    if (isLayerOverridden) return;
    const map = mapRef.current;
    if (!map || tiles.length === 0) return;

    const nonClusterCount = tiles.reduce((sum, tile) => {
      if (!Array.isArray(tile.features)) return sum;
      return sum + tile.features.filter((feature) => feature.type !== "cluster").length;
    }, 0);

    if (nonClusterCount > GLOBAL_DOM_BUDGET) {
      setActiveLayer((current) => {
        if (current === "balloon") return "pulse";
        if (current === "pulse") return "cluster";
        return current;
      });
    }
  }, [tiles, isLayerOverridden]);

  const featureCollection = useMemo(() => buildFeatureCollection(tiles), [tiles]);

  const syncContainerSize = useCallback(() => {
    const container = mapContainerRef.current;
    if (!container) return false;
    const rect = container.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }, []);

  useEffect(() => {
    if (mapRef.current) return;

    let frameId: number | null = null;
    let aborted = false;

    const initializeMap = () => {
      if (aborted) return;
      const container = mapContainerRef.current;
      if (!container || mapRef.current) return;

      const hasSize = syncContainerSize();
      const { width, height } = container.getBoundingClientRect();
      if (!hasSize || width <= 0 || height <= 0) {
        frameId = window.requestAnimationFrame(initializeMap);
        return;
      }

      const map = new mapboxgl.Map({
        container,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [initialView.longitude, initialView.latitude],
        zoom: initialView.zoom
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      mapRef.current = map;

      if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(() => {
          map.resize();
        });
        observer.observe(container);
        resizeObserverRef.current = observer;
      }

      window.requestAnimationFrame(() => {
        map.resize();
      });

      const handleLoad = () => {
        ensureMapLayers(map);
        setTileCoordinates(getVisibleTiles(map));
        if (!isLayerOverridden) {
          setActiveLayer(deriveLayerForZoom(map.getZoom()));
        }
      };

      if (map.isStyleLoaded()) {
        handleLoad();
      } else {
        map.once("load", handleLoad);
      }
    };

    initializeMap();

    return () => {
      aborted = true;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      const map = mapRef.current;
      if (map) {
        map.remove();
        mapRef.current = null;
      }
      if (selectionMarkerRef.current) {
        selectionMarkerRef.current.remove();
        selectionMarkerRef.current = null;
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [initialView, syncContainerSize, isLayerOverridden]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleStyleData = () => {
      ensureMapLayers(map);
    };

    if (map.isStyleLoaded()) {
      ensureMapLayers(map);
    } else {
      map.once("load", () => ensureMapLayers(map));
    }

    map.on("styledata", handleStyleData);
    return () => {
      map.off("styledata", handleStyleData);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const updateTiles = () => {
      setTileCoordinates(getVisibleTiles(map));
      if (!isLayerOverridden) {
        setActiveLayer(deriveLayerForZoom(map.getZoom()));
      }
    };

    updateTiles();
    map.on("moveend", updateTiles);

    return () => {
      map.off("moveend", updateTiles);
    };
  }, [categoriesKey, tilePremiumOnly, isLayerOverridden, tileLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource(TILE_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    source.setData(featureCollection as FeatureCollection<Point>);
  }, [featureCollection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const setPointer = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const unsetPointer = () => {
      map.getCanvas().style.cursor = "";
    };

    INTERACTIVE_LAYERS.forEach((layer) => {
      map.on("mouseenter", layer, setPointer);
      map.on("mouseleave", layer, unsetPointer);
    });

    return () => {
      INTERACTIVE_LAYERS.forEach((layer) => {
        map.off("mouseenter", layer, setPointer);
        map.off("mouseleave", layer, unsetPointer);
      });
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleSpotClick = (event: mapboxgl.MapLayerMouseEvent) => {
      event.preventDefault();
      const spotId = event.features?.[0]?.properties?.spotId as string | undefined;
      if (spotId) {
        onSpotClick?.(spotId);
      }
    };

    const handleClusterClick = (event: mapboxgl.MapLayerMouseEvent) => {
      event.preventDefault();
      const zoom = Math.min(map.getZoom() + 1.5, MAX_ZOOM);
      map.easeTo({ center: event.lngLat, zoom });
    };

    const handleCanvasClick = (event: mapboxgl.MapMouseEvent) => {
      if (!onSelectLocation) return;
      const features = map.queryRenderedFeatures(event.point, { layers: INTERACTIVE_LAYERS });
      if (features.length > 0) return;
      const { lat, lng } = event.lngLat;
      onSelectLocation({ lat, lng });
    };

    if (onSpotClick) {
      map.on("click", LAYER_PULSE, handleSpotClick);
      map.on("click", LAYER_BALLOON, handleSpotClick);
    }
    map.on("click", LAYER_CLUSTER, handleClusterClick);
    map.on("click", handleCanvasClick);

    return () => {
      if (onSpotClick) {
        map.off("click", LAYER_PULSE, handleSpotClick);
        map.off("click", LAYER_BALLOON, handleSpotClick);
      }
      map.off("click", LAYER_CLUSTER, handleClusterClick);
      map.off("click", handleCanvasClick);
    };
  }, [onSpotClick, onSelectLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapContainerRef.current) return;

    const handleResize = () => {
      syncContainerSize();
      map.resize();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [syncContainerSize]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!selectedLocation) {
      if (selectionMarkerRef.current) {
        selectionMarkerRef.current.remove();
        selectionMarkerRef.current = null;
      }
      return;
    }

    if (!selectionMarkerRef.current) {
      selectionMarkerRef.current = new mapboxgl.Marker({ color: "#22d3ee" });
    }

    selectionMarkerRef.current
      .setLngLat([selectedLocation.lng, selectedLocation.lat])
      .addTo(map);
  }, [selectedLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusCoordinates) return;

    map.flyTo({
      center: [focusCoordinates.lng, focusCoordinates.lat],
      zoom: Math.max(map.getZoom(), 15),
      essential: true
    });
  }, [focusCoordinates]);

  return <div className="map-container" ref={mapContainerRef} role="presentation" />;
};
