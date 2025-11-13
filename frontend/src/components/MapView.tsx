import "../styles/components/MapView.css";

import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { Map as MapboxMap } from "mapbox-gl";
import * as tilebelt from "@mapbox/tilebelt";
import styled from 'styled-components';
import type { Feature, FeatureCollection, Point } from "geojson";
import "mapbox-gl/dist/mapbox-gl.css";

import { useMapTiles } from "../hooks/useMapTiles";
import { SpotCalloutManager } from "../lib/map/SpotCalloutManager";
import { parseLocalTimestamp } from "../lib/map/time";
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
const GRID_MAX_ZOOM = 9;
const PULSE_DENSITY_THRESHOLD = Math.floor(GLOBAL_DOM_BUDGET * 0.6);
const CLUSTER_DENSITY_THRESHOLD = Math.floor(GLOBAL_DOM_BUDGET * 0.75);
const MAX_CALLOUT_VISIBLE = 36;
const MAX_CALLOUT_PREMIUM = 18;

const deriveLayerForZoom = (zoom: number): MapTileLayer => {
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
  onActiveLayerChange: (layer: MapTileLayer) => void;
};

const useMapTileWatcher = ({
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

type CanvasRendererParams = {
  mapRef: MutableRefObject<MapboxMap | null>;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  contextRef: MutableRefObject<CanvasRenderingContext2D | null>;
  renderMode: MapTileLayer | "canvas";
  fallbackSpots: MapTileFeature[];
};

const useCanvasRenderer = ({
  mapRef,
  canvasRef,
  contextRef,
  renderMode,
  fallbackSpots
}: CanvasRendererParams) => {
  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!map || !canvas || !context) return;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const mapCanvas = map.getCanvas();
      const { width, height } = mapCanvas;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.scale(dpr, dpr);
      }
    };

    const draw = () => {
      resizeCanvas();
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (renderMode !== "canvas" || fallbackSpots.length === 0) return;

      context.fillStyle = "rgba(59, 130, 246, 0.7)";
      context.strokeStyle = "rgba(15, 23, 42, 0.8)";
      context.lineWidth = 1;

      fallbackSpots.forEach((feature) => {
        const point = map.project([feature.geometry.lng, feature.geometry.lat]);
        context.beginPath();
        context.arc(point.x, point.y, feature.premium ? 6 : 4, 0, Math.PI * 2);
        context.fill();
        context.stroke();
      });
    };

    draw();
    map.on("move", draw);
    map.on("moveend", draw);
    map.on("zoom", draw);
    map.on("zoomend", draw);
    map.on("resize", draw);

    return () => {
      map.off("move", draw);
      map.off("moveend", draw);
      map.off("zoom", draw);
      map.off("zoomend", draw);
      map.off("resize", draw);
    };
  }, [fallbackSpots, mapRef, canvasRef, contextRef, renderMode]);
};

type GeoJsonSourceParams = {
  mapRef: MutableRefObject<MapboxMap | null>;
  featureCollection: FeatureCollection<Point, FeatureProperties>;
  renderMode: MapTileLayer | "canvas";
};

const useGeoJsonSource = ({ mapRef, featureCollection, renderMode }: GeoJsonSourceParams) => {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource(TILE_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;

    const data =
      renderMode === "canvas"
        ? {
            type: "FeatureCollection" as const,
            features: featureCollection.features.filter((feature) => {
              const type = feature.properties?.featureType;
              return type === "cluster" || feature.properties?.premium === true;
            })
          }
        : featureCollection;

    source.setData(data as FeatureCollection<Point>);
  }, [featureCollection, mapRef, renderMode]);
};

const useInteractiveCursor = (mapRef: MutableRefObject<MapboxMap | null>) => {
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
  }, [mapRef]);
};

type InteractionParams = {
  mapRef: MutableRefObject<MapboxMap | null>;
  calloutManagerRef: MutableRefObject<SpotCalloutManager | null>;
  renderMode: MapTileLayer | "canvas";
  calloutCandidates: MapTileFeature[];
  onSpotClick?: MapViewProps["onSpotClick"];
  onSpotClickRef: MutableRefObject<MapViewProps["onSpotClick"]>;
  onSelectLocation?: MapViewProps["onSelectLocation"];
  selectionMarkerRef: MutableRefObject<mapboxgl.Marker | null>;
  selectedLocation: Coordinates | null;
  focusCoordinates: Coordinates | null;
};

const useMapEventHandlers = ({
  mapRef,
  calloutManagerRef,
  renderMode,
  calloutCandidates,
  onSpotClick,
  onSpotClickRef,
  onSelectLocation,
  selectionMarkerRef,
  selectedLocation,
  focusCoordinates
}: InteractionParams) => {
  useEffect(() => {
    const map = mapRef.current;
    const manager = calloutManagerRef.current;
    if (!map || !manager) return;

    manager.updateSelectHandler((spotId) => {
      const handler = onSpotClickRef.current;
      if (handler) {
        handler(spotId);
      }
    });

    if (renderMode === "balloon" && calloutCandidates.length > 0) {
      const premium = calloutCandidates.filter((feature) => feature.premium);
      const regular = calloutCandidates.filter((feature) => !feature.premium);
      const limitedPremium = premium.slice(0, MAX_CALLOUT_PREMIUM);
      const remainingSlots = Math.max(0, MAX_CALLOUT_VISIBLE - limitedPremium.length);
      const limitedRegular = remainingSlots > 0 ? regular.slice(0, remainingSlots) : [];
      manager.sync([...limitedPremium, ...limitedRegular]);
    } else {
      manager.clear();
    }

    const handleRelayout = () => {
      manager.repositionAll();
    };

    manager.repositionAll();

    map.on("move", handleRelayout);
    map.on("zoom", handleRelayout);
    map.on("rotate", handleRelayout);
    map.on("pitch", handleRelayout);
    map.on("resize", handleRelayout);

    return () => {
      map.off("move", handleRelayout);
      map.off("zoom", handleRelayout);
      map.off("rotate", handleRelayout);
      map.off("pitch", handleRelayout);
      map.off("resize", handleRelayout);
      if (renderMode !== "balloon") {
        manager.clear();
      }
    };
  }, [calloutCandidates, calloutManagerRef, mapRef, onSpotClickRef, renderMode]);

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
  }, [mapRef, onSpotClick, onSelectLocation]);

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

    selectionMarkerRef.current.setLngLat([selectedLocation.lng, selectedLocation.lat]).addTo(map);
  }, [mapRef, selectedLocation, selectionMarkerRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusCoordinates) return;

    map.flyTo({
      center: [focusCoordinates.lng, focusCoordinates.lat],
      zoom: Math.max(map.getZoom(), 15),
      essential: true
    });
  }, [focusCoordinates, mapRef]);
};

const useCanvasContextSetup = ({
  mapRef,
  canvasRef,
  contextRef
}: {
  mapRef: MutableRefObject<MapboxMap | null>;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  contextRef: MutableRefObject<CanvasRenderingContext2D | null>;
}) => {
  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    contextRef.current = context;

    const updateCanvasSize = () => {
      const { width, height } = map.getCanvas();
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    updateCanvasSize();
    map.on("resize", updateCanvasSize);

    return () => {
      map.off("resize", updateCanvasSize);
    };
  }, [canvasRef, contextRef, mapRef]);
};

type MapInitializationParams = {
  mapRef: MutableRefObject<MapboxMap | null>;
  mapContainerRef: MutableRefObject<HTMLDivElement | null>;
  initialViewRef: MutableRefObject<MapViewProps['initialView']>;
  scheduleMapResize: (label?: string) => void;
  calloutLayerRef: MutableRefObject<HTMLDivElement | null>;
  calloutManagerRef: MutableRefObject<SpotCalloutManager | null>;
  onSpotClickRef: MutableRefObject<MapViewProps['onSpotClick']>;
  resizeObserverRef: MutableRefObject<ResizeObserver | null>;
  selectionMarkerRef: MutableRefObject<mapboxgl.Marker | null>;
  isLayerOverridden: boolean;
  setTileCoordinates: (tiles: TileCoordinate[]) => void;
  setActiveLayer: (layer: MapTileLayer | undefined) => void;
};

const useMapInitialization = ({
  mapRef,
  mapContainerRef,
  initialViewRef,
  scheduleMapResize,
  calloutLayerRef,
  calloutManagerRef,
  onSpotClickRef,
  resizeObserverRef,
  selectionMarkerRef,
  isLayerOverridden,
  setTileCoordinates,
  setActiveLayer
}: MapInitializationParams) => {
  useEffect(() => {
    if (mapRef.current) return;

    let frameId: number | null = null;
    let aborted = false;

    const initializeMap = () => {
      if (aborted) return;
      const container = mapContainerRef.current;
      if (!container || mapRef.current) return;

      const { width, height } = container.getBoundingClientRect();
      if (width <= 0 || height <= 0) {
        frameId = window.requestAnimationFrame(initializeMap);
        return;
      }

      const view = initialViewRef.current;

      const map = new mapboxgl.Map({
        container,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [view.longitude, view.latitude],
        zoom: view.zoom,
        projection: "mercator"
      });

      map.addControl(new mapboxgl.NavigationControl(), "top-right");
      mapRef.current = map;

      if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(() => {
          scheduleMapResize("resize-observer");
        });
        observer.observe(container);
        resizeObserverRef.current = observer;
      }

      scheduleMapResize("initialized");

      const calloutLayer = document.createElement("div");
      calloutLayer.className = "map-callout-layer";
      map.getCanvasContainer().appendChild(calloutLayer);
      calloutLayerRef.current = calloutLayer;
      calloutManagerRef.current = new SpotCalloutManager(map, calloutLayer, (spotId: string) => {
        const handler = onSpotClickRef.current;
        if (handler) {
          handler(spotId);
        }
      });

      const handleLoad = () => {
        ensureMapLayers(map);
        setTileCoordinates(getVisibleTiles(map));
        if (!isLayerOverridden) {
          setActiveLayer(deriveLayerForZoom(map.getZoom()));
        }
        scheduleMapResize("map-load");
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
      if (calloutManagerRef.current) {
        calloutManagerRef.current.destroy();
        calloutManagerRef.current = null;
      }
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (calloutLayerRef.current) {
        const container = calloutLayerRef.current;
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
        calloutLayerRef.current = null;
      }
    };
  }, [calloutLayerRef, calloutManagerRef, initialViewRef, isLayerOverridden, mapContainerRef, mapRef, onSpotClickRef, resizeObserverRef, scheduleMapResize, selectionMarkerRef, setActiveLayer, setTileCoordinates]);
};

const useWindowResize = ({
  scheduleMapResize,
  resizeAnimationFrameRef
}: {
  scheduleMapResize: (label?: string) => void;
  resizeAnimationFrameRef: MutableRefObject<number | null>;
}) => {
  useEffect(() => {
    const handleWindowResize = () => {
      if (typeof window === "undefined") return;
      if (resizeAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeAnimationFrameRef.current);
      }
      resizeAnimationFrameRef.current = window.requestAnimationFrame(() => {
        resizeAnimationFrameRef.current = null;
        scheduleMapResize("window-resize");
      });
    };

    window.addEventListener("resize", handleWindowResize);
    window.addEventListener("orientationchange", handleWindowResize);

    return () => {
      window.removeEventListener("resize", handleWindowResize);
      window.removeEventListener("orientationchange", handleWindowResize);
      if (resizeAnimationFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeAnimationFrameRef.current);
        resizeAnimationFrameRef.current = null;
      }
    };
  }, [resizeAnimationFrameRef, scheduleMapResize]);
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

type RenderingData = {
  featureCollection: FeatureCollection<Point, FeatureProperties>;
  calloutCandidates: MapTileFeature[];
  nonClusterCount: number;
  premiumCount: number;
  spotFeatures: MapTileFeature[];
};

const buildRenderingData = (tiles: MapTileResponse[]): RenderingData => {
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
        const endTime = parseLocalTimestamp(feature.spot?.endTime);
        if (endTime !== null && endTime <= now) {
          return;
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

  const remainingBudget = Math.max(0, GLOBAL_DOM_BUDGET - premiumSpots.length);
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
        title:
          feature.spot?.ownerDisplayName ?? feature.spot?.title ?? feature.spot?.ownerId ?? "",
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
  premium?: boolean;
  status?: "upcoming" | "live" | "ended";
  popularity?: number;
};

const MapOuter = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const MapRoot = styled.div.attrs({ className: 'map-container' })`
  width: 100%;
  height: 100%;
  flex: 1 1 auto;
  min-height: 0;
`;

const MapCanvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  width: 100%;
  height: 100%;
`;

export const MapView = ({
  initialView,
  selectedLocation,
  onSelectLocation,
  focusCoordinates,
  onSpotClick,
  tileLayer,
  tileCategories,
  tilePremiumOnly,
  authToken
}: MapViewProps) => {

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapOuterRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const initialViewRef = useRef(initialView);
  const selectionMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeAnimationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null);
  const calloutManagerRef = useRef<SpotCalloutManager | null>(null);
  const calloutLayerRef = useRef<HTMLDivElement | null>(null);
  const onSpotClickRef = useRef<MapViewProps['onSpotClick']>(onSpotClick);

  const { longitude: initialLongitude, latitude: initialLatitude, zoom: initialZoom } = initialView;

  const [fallbackSpots, setFallbackSpots] = useState<MapTileFeature[]>([]);
  const [renderMode, setRenderMode] = useState<MapTileLayer | 'canvas'>('balloon');
  const [tileCoordinates, setTileCoordinates] = useState<TileCoordinate[]>([]);
  const [activeLayer, setActiveLayer] = useState<MapTileLayer | undefined>(tileLayer);

  const isLayerOverridden = tileLayer !== undefined;

  useEffect(() => {
    initialViewRef.current = {
      longitude: initialLongitude,
      latitude: initialLatitude,
      zoom: initialZoom
    };
  }, [initialLatitude, initialLongitude, initialZoom]);

  useEffect(() => {
    if (isLayerOverridden && tileLayer !== undefined) {
      setActiveLayer(tileLayer);
      setRenderMode(tileLayer);
    }
  }, [isLayerOverridden, tileLayer]);

  const { tiles, error: tilesError } = useMapTiles({
    coordinates: tileCoordinates,
    layer: isLayerOverridden && tileLayer ? tileLayer : activeLayer,
    categories: tileCategories,
    premiumOnly: tilePremiumOnly,
    authToken,
    enabled: tileCoordinates.length > 0
  });


  useEffect(() => {
    if (tilesError) {
      console.warn('Failed to load map tiles', tilesError);
    }
  }, [tilesError]);

  const renderingData = useMemo(() => buildRenderingData(tiles), [tiles]);
  const featureCollection = renderingData.featureCollection;
  const calloutCandidates = renderingData.calloutCandidates;

  useEffect(() => {
    onSpotClickRef.current = onSpotClick;
  }, [onSpotClick]);

  const handleLayerDensity = useCallback(
    (layer: MapTileLayer, nonClusterCount: number, zoom: number): MapTileLayer | 'canvas' => {
      let nextLayer: MapTileLayer | 'canvas' = layer;
      if (nextLayer === 'balloon' && (nonClusterCount > PULSE_DENSITY_THRESHOLD || zoom < 10.5)) {
        nextLayer = 'pulse';
      }
      if (nextLayer === 'pulse' && (nonClusterCount > CLUSTER_DENSITY_THRESHOLD || zoom <= GRID_MAX_ZOOM + 0.2)) {
        nextLayer = 'cluster';
      }
      if (nextLayer === 'cluster' && nonClusterCount > GLOBAL_DOM_BUDGET) {
        return 'canvas';
      }
      return nextLayer;
    },
    []
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || tiles.length === 0) return;

    if (isLayerOverridden) {
      setRenderMode(tileLayer ?? 'balloon');
      return;
    }

    const zoom = map.getZoom();
    const baseLayer = deriveLayerForZoom(zoom);
    const nextLayer = handleLayerDensity(baseLayer, renderingData.nonClusterCount, zoom);

    if (nextLayer === 'canvas') {
      setActiveLayer('cluster');
      setRenderMode('canvas');
      return;
    }

    setActiveLayer(nextLayer);
    setRenderMode(nextLayer);
  }, [tiles.length, isLayerOverridden, tileLayer, handleLayerDensity, renderingData.nonClusterCount]);

  useEffect(() => {
    if (renderMode !== 'canvas') {
      setFallbackSpots([]);
      return;
    }

    const nonPremium = renderingData.spotFeatures.filter((feature) => !feature.premium);
    setFallbackSpots(nonPremium);
  }, [renderingData.spotFeatures, renderMode]);

  const scheduleMapResize = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (resizeAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(resizeAnimationFrameRef.current);
    }
    resizeAnimationFrameRef.current = window.requestAnimationFrame(() => {
      resizeAnimationFrameRef.current = null;
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });
  }, []);

  useMapInitialization({
    mapRef,
    mapContainerRef,
    initialViewRef,
    scheduleMapResize,
    calloutLayerRef,
    calloutManagerRef,
    onSpotClickRef,
    resizeObserverRef,
    selectionMarkerRef,
    isLayerOverridden,
    setTileCoordinates,
    setActiveLayer
  });

  useWindowResize({ scheduleMapResize, resizeAnimationFrameRef });

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();

    const centerChanged =
      Math.abs(currentCenter.lng - initialLongitude) > 0.000001 ||
      Math.abs(currentCenter.lat - initialLatitude) > 0.000001;
    const zoomChanged = Math.abs(currentZoom - initialZoom) > 0.000001;

    if (centerChanged || zoomChanged) {
      map.jumpTo({ center: [initialLongitude, initialLatitude], zoom: initialZoom });
    }
  }, [initialLatitude, initialLongitude, initialZoom]);

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

  useMapTileWatcher({
    mapRef,
    isLayerOverridden,
    tileLayer,
    onTilesChange: setTileCoordinates,
    onActiveLayerChange: setActiveLayer
  });

  useCanvasRenderer({
    mapRef,
    canvasRef,
    contextRef: canvasContextRef,
    renderMode,
    fallbackSpots
  });
  useGeoJsonSource({ mapRef, featureCollection, renderMode });
  useInteractiveCursor(mapRef);
  useMapEventHandlers({
    mapRef,
    calloutManagerRef,
    renderMode,
    calloutCandidates,
    onSpotClick,
    onSpotClickRef,
    onSelectLocation,
    selectionMarkerRef,
    selectedLocation,
    focusCoordinates
  });
  useCanvasContextSetup({ mapRef, canvasRef, contextRef: canvasContextRef });

  return (
    <MapOuter role="presentation" ref={mapOuterRef}>
      <MapRoot ref={mapContainerRef} />
      <MapCanvas ref={canvasRef} aria-hidden="true" />
    </MapOuter>
  );
};

export default MapView;
