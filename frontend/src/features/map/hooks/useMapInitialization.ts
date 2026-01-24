import { MutableRefObject, useEffect } from "react";
import mapboxgl, { Map as MapboxMap } from "mapbox-gl";
import { useGlobalMap } from "../GlobalMapProvider";
import { SpotCalloutManager } from "../../../lib/map/SpotCalloutManager";
import { TaskScheduler } from "../../../lib/map/TaskScheduler";
import { MapTileLayer, TileCoordinate } from "../../../types";
import { deriveLayerForZoom, ensureMapLayers, getVisibleTiles } from "./useMapLayerLogic";

const CALLOUT_POOL_SIZE = 64;

type MapInitializationParams = {
    mapRef: MutableRefObject<MapboxMap | null>;
    mapContainerRef: MutableRefObject<HTMLDivElement | null>;
    initialViewRef: MutableRefObject<{ longitude: number; latitude: number; zoom: number }>;
    scheduleMapResize: (label?: string) => void;
    calloutLayerRef: MutableRefObject<HTMLDivElement | null>;
    calloutManagerRef: MutableRefObject<SpotCalloutManager | null>;
    onSpotClickRef: MutableRefObject<((spotId: string) => void) | undefined>;
    resizeObserverRef: MutableRefObject<ResizeObserver | null>;
    selectionMarkerRef: MutableRefObject<mapboxgl.Marker | null>;
    isLayerOverridden: boolean;
    setTileCoordinates: (tiles: TileCoordinate[]) => void;
    setActiveLayer: (layer: MapTileLayer | undefined) => void;
    taskScheduler: TaskScheduler;
};

export const useMapInitialization = ({
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
}: MapInitializationParams) => {
    const { map: globalMap, attach, detach, isReady } = useGlobalMap();

    useEffect(() => {
        if (mapRef.current || !isReady || !globalMap) return;

        let frameId: number | null = null;
        let aborted = false;

        const initializeMap = () => {
            if (aborted) return;
            const container = mapContainerRef.current;
            if (!container) return;

            const { width, height } = container.getBoundingClientRect();
            if (width <= 0 || height <= 0) {
                frameId = window.requestAnimationFrame(initializeMap);
                return;
            }

            // Attach global map to this container
            attach(container);
            mapRef.current = globalMap;
            const map = globalMap;

            // Reset view to initial view
            const view = initialViewRef.current;
            map.jumpTo({
                center: [view.longitude, view.latitude],
                zoom: view.zoom
            });

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
            }, CALLOUT_POOL_SIZE, taskScheduler);

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

            // Detach map instead of removing it
            detach();
            mapRef.current = null;

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
    }, [
        calloutLayerRef, calloutManagerRef, initialViewRef, isLayerOverridden,
        mapContainerRef, mapRef, onSpotClickRef, resizeObserverRef,
        scheduleMapResize, selectionMarkerRef, setActiveLayer, setTileCoordinates,
        taskScheduler, globalMap, attach, detach, isReady
    ]);
};

export const useWindowResize = ({
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
