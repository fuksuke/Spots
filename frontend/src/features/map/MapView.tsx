import "../../styles/components/MapView.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { Map as MapboxMap } from "mapbox-gl";
import styled from 'styled-components';
import "mapbox-gl/dist/mapbox-gl.css";

import { useMapTiles } from "../../hooks/useMapTiles";
import { SpotCalloutManager } from "../../lib/map/SpotCalloutManager";
import { TaskScheduler } from "../../lib/map/TaskScheduler";
import { PremiumLRUCache } from "../../lib/map/PremiumLRUCache";
import { FPSMonitor } from "../../lib/map/FPSMonitor";
import { trackEvent } from "../../lib/analytics";
import type {
  Coordinates,
  MapTileFeature,
  MapTileLayer,
  Spot,
  SpotCategory,
  TileCoordinate
} from "../../types";
import { AdPlaceholder } from "../../components/ui/AdPlaceholder";

// Extracted Hooks
import { useInteractiveMap, useInteractiveCursor } from "./hooks/useInteractiveMap";
import {
  useMapTileWatcher,
  useZoomPrefetch,
  buildRenderingData,
  deriveLayerForZoom,
  DOM_BUDGET,
  ensureMapLayers
} from "./hooks/useMapLayerLogic";
import {
  useCanvasRenderer,
  useGeoJsonSource,
  useCanvasContextSetup
} from "./hooks/useMapRenderer";
import {
  useMapInitialization,
  useWindowResize
} from "./hooks/useMapInitialization";

// Constants
const GRID_MAX_ZOOM = 9;
const PULSE_DENSITY_THRESHOLD = Math.floor(DOM_BUDGET * 0.6);
const CLUSTER_DENSITY_THRESHOLD = Math.floor(DOM_BUDGET * 0.75);

// Styled Components
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
  onSpotView?: (spotId: string) => void;
  tileLayer?: MapTileLayer;
  tileCategories?: SpotCategory[];
  tilePremiumOnly?: boolean;
  authToken?: string;
};

export const MapView = ({
  initialView,
  selectedLocation = null,
  onSelectLocation,
  focusCoordinates = null,
  onSpotClick,
  onSpotView,
  tileLayer,
  tileCategories,
  tilePremiumOnly,
  authToken
}: MapViewProps) => {

  // Refs
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
  const onSpotClickRef = useRef<((spotId: string) => void) | undefined>(onSpotClick);
  const onSpotViewRef = useRef<((spotId: string) => void) | undefined>(onSpotView);
  const mountTimeRef = useRef<number | null>(null);
  const premiumCacheRef = useRef<PremiumLRUCache<string, MapTileFeature> | null>(null);
  const fpsMonitorRef = useRef<FPSMonitor | null>(null);

  const [taskScheduler] = useState(() => new TaskScheduler());

  const { longitude: initialLongitude, latitude: initialLatitude, zoom: initialZoom } = initialView;

  // State
  const [fallbackSpots, setFallbackSpots] = useState<MapTileFeature[]>([]);
  const [renderMode, setRenderMode] = useState<MapTileLayer | 'canvas'>('balloon');
  const [tileCoordinates, setTileCoordinates] = useState<TileCoordinate[]>([]);
  const [activeLayer, setActiveLayer] = useState<MapTileLayer | undefined>(tileLayer);

  const isLayerOverridden = tileLayer !== undefined;

  // Sync refs/props
  useEffect(() => {
    initialViewRef.current = {
      longitude: initialLongitude,
      latitude: initialLatitude,
      zoom: initialZoom
    };
  }, [initialLatitude, initialLongitude, initialZoom]);

  useEffect(() => {
    onSpotClickRef.current = onSpotClick;
  }, [onSpotClick]);

  useEffect(() => {
    onSpotViewRef.current = onSpotView;
  }, [onSpotView]);

  useEffect(() => {
    if (isLayerOverridden && tileLayer !== undefined) {
      setActiveLayer(tileLayer);
      setRenderMode(tileLayer);
    }
  }, [isLayerOverridden, tileLayer]);

  // Cleanups
  useEffect(() => {
    return () => {
      taskScheduler.cancel();
      if (premiumCacheRef.current) {
        premiumCacheRef.current.clear();
        premiumCacheRef.current = null;
      }
      if (fpsMonitorRef.current) {
        fpsMonitorRef.current.stop();
        fpsMonitorRef.current = null;
      }
    };
  }, [taskScheduler]);

  // Performance Monitors
  useEffect(() => {
    if (!premiumCacheRef.current) {
      premiumCacheRef.current = new PremiumLRUCache<string, MapTileFeature>(50);
    }
    if (!fpsMonitorRef.current) {
      const FPS_THRESHOLD = 30;
      fpsMonitorRef.current = new FPSMonitor(
        FPS_THRESHOLD,
        (fps) => {
          console.warn(`[MapView] Low FPS detected: ${fps}. Triggering performance degradation.`);
          if (!isLayerOverridden) {
            setRenderMode('canvas');
          }
        },
        60, 60
      );
      fpsMonitorRef.current.start();
    }
  }, [isLayerOverridden]);

  // Data Fetching
  const { tiles, error: tilesError } = useMapTiles({
    coordinates: tileCoordinates,
    layer: isLayerOverridden && tileLayer ? tileLayer : activeLayer,
    categories: tileCategories,
    premiumOnly: tilePremiumOnly,
    authToken,
    enabled: tileCoordinates.length > 0
  });

  useEffect(() => {
    if (tilesError) console.warn('Failed to load map tiles', tilesError);
  }, [tilesError]);

  const renderingData = useMemo(() => buildRenderingData(tiles), [tiles]);
  const featureCollection = renderingData.featureCollection;
  const calloutCandidates = renderingData.calloutCandidates;

  useEffect(() => {
    mountTimeRef.current = performance.now();
    return () => {
      if (mountTimeRef.current) {
        const dwellSeconds = (performance.now() - mountTimeRef.current) / 1000;
        trackEvent("map_dwell", { seconds: dwellSeconds });
      }
    };
  }, []);

  // Layer Density Logic
  const handleLayerDensity = useCallback(
    (layer: MapTileLayer, nonClusterCount: number, zoom: number): MapTileLayer | 'canvas' => {
      let nextLayer: MapTileLayer | 'canvas' = layer;
      if (nextLayer === 'balloon' && (nonClusterCount > PULSE_DENSITY_THRESHOLD || zoom < 10.5)) {
        nextLayer = 'pulse';
      }
      if (nextLayer === 'pulse' && (nonClusterCount > CLUSTER_DENSITY_THRESHOLD || zoom <= GRID_MAX_ZOOM + 0.2)) {
        nextLayer = 'cluster';
      }
      if (nextLayer === 'cluster' && nonClusterCount > DOM_BUDGET) {
        return 'canvas';
      }
      return nextLayer;
    },
    []
  );

  // Auto-switch layers
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

  // Fallback spots update (Canvas mode)
  useEffect(() => {
    if (renderMode !== 'canvas') {
      setFallbackSpots([]);
      const ctx = canvasContextRef.current;
      const canvas = canvasRef.current;
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }
    const nonPremium = renderingData.spotFeatures.filter((feature) => !feature.premium);
    setFallbackSpots(nonPremium);
  }, [renderingData.spotFeatures, renderMode]);

  // Map Initialization & Resize
  const scheduleMapResize = useCallback((label?: string) => {
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
    setActiveLayer,
    taskScheduler
  });

  useWindowResize({ scheduleMapResize, resizeAnimationFrameRef });

  // Map Movement Sync (Initial View Jump)
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

  // Ensure Layers on Style Load (Backup)
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

  // Hooks Integration
  useMapTileWatcher({
    mapRef,
    isLayerOverridden,
    tileLayer,
    onTilesChange: setTileCoordinates,
    onActiveLayerChange: setActiveLayer
  });

  // Prefetch child tiles when zooming in
  useZoomPrefetch({
    mapRef,
    currentTiles: tileCoordinates,
    layer: isLayerOverridden && tileLayer ? tileLayer : activeLayer,
    categories: tileCategories,
    premiumOnly: tilePremiumOnly,
    authToken,
    enabled: tileCoordinates.length > 0
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
  useInteractiveMap({
    mapRef,
    calloutManagerRef,
    renderMode,
    calloutCandidates,
    fallbackSpots,
    onSpotClick,
    onSpotView,
    onSpotClickRef,
    onSpotViewRef,
    onSelectLocation,
    selectionMarkerRef,
    selectedLocation,
    focusCoordinates,
    premiumCacheRef
  });
  useCanvasContextSetup({ mapRef, canvasRef, contextRef: canvasContextRef });

  return (
    <MapOuter role="presentation" ref={mapOuterRef}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        zIndex: 10,
        display: 'flex',
        justifyContent: 'flex-start',
        paddingTop: '0.5rem',
        paddingLeft: '0.5rem',
        pointerEvents: 'none'
      }}>
        <AdPlaceholder type="thin" label="スポンサー" style={{ width: 'auto', minWidth: '300px', margin: 0 }} />
      </div>
      <MapRoot ref={mapContainerRef} />
      <MapCanvas ref={canvasRef} aria-hidden="true" />
    </MapOuter>
  );
};

export default MapView;
