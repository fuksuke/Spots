import { MutableRefObject, useEffect } from "react";
import mapboxgl, { Map as MapboxMap } from "mapbox-gl";
import { SpotCalloutManager } from "../../../lib/map/SpotCalloutManager";
import { PremiumLRUCache } from "../../../lib/map/PremiumLRUCache";
import { Coordinates, MapTileFeature, MapTileLayer } from "../../../types";

const INTERACTIVE_LAYERS = ["map-tiles-layer-balloon", "map-tiles-layer-pulse", "map-tiles-layer-cluster"];
const LAYER_CLUSTER = "map-tiles-layer-cluster";
const LAYER_PULSE = "map-tiles-layer-pulse";
const LAYER_BALLOON = "map-tiles-layer-balloon";
const MAX_ZOOM = 20;

// Constants from MapView (duplicated to avoid dependency)
const BASE_DOM_BUDGET = 300;
// We might need to pass these as config, but for now hardcode or assume same env
const DOM_BUDGET = BASE_DOM_BUDGET;
const MAX_CALLOUT_VISIBLE = Math.max(20, Math.floor(DOM_BUDGET * 0.12));
const MAX_CALLOUT_PREMIUM = Math.max(10, Math.floor(MAX_CALLOUT_VISIBLE * 0.5));

export const useInteractiveCursor = (mapRef: MutableRefObject<MapboxMap | null>) => {
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
    fallbackSpots: MapTileFeature[];
    onSpotClick?: (spotId: string) => void;
    onSpotView?: (spotId: string) => void;
    onSpotClickRef: MutableRefObject<((spotId: string) => void) | undefined>;
    onSpotViewRef: MutableRefObject<((spotId: string) => void) | undefined>;
    onSelectLocation?: (coords: Coordinates) => void;
    selectionMarkerRef: MutableRefObject<mapboxgl.Marker | null>;
    selectedLocation: Coordinates | null;
    focusCoordinates: Coordinates | null;
    premiumCacheRef: MutableRefObject<PremiumLRUCache<string, MapTileFeature> | null>;
};

export const useInteractiveMap = ({
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
}: InteractionParams) => {
    // Sync Callout Manager
    useEffect(() => {
        const map = mapRef.current;
        const manager = calloutManagerRef.current;
        if (!map || !manager) return;

        manager.updateSelectHandler((spotId) => {
            const viewHandler = onSpotViewRef.current;
            if (viewHandler) {
                viewHandler(spotId);
            }
            const handler = onSpotClickRef.current;
            if (handler) {
                handler(spotId);
            }
        });

        if (renderMode === "balloon" && calloutCandidates.length > 0) {
            const premium = calloutCandidates.filter((feature) => feature.premium);
            const regular = calloutCandidates.filter((feature) => !feature.premium);

            // Use PremiumLRUCache to manage premium spots
            const premiumCache = premiumCacheRef.current;
            let limitedPremium = premium;
            if (premiumCache) {
                premium.forEach((feature) => {
                    premiumCache.set(feature.id, feature);
                });
                const cachedPremium = premiumCache.values();
                limitedPremium = cachedPremium.slice(0, MAX_CALLOUT_PREMIUM);
            } else {
                limitedPremium = premium.slice(0, MAX_CALLOUT_PREMIUM);
            }

            const remainingSlots = Math.max(0, MAX_CALLOUT_VISIBLE - limitedPremium.length);
            const limitedRegular = remainingSlots > 0 ? regular.slice(0, remainingSlots) : [];
            manager.sync([...limitedPremium, ...limitedRegular]);
        } else {
            manager.clear();
        }

        let rafId: number | null = null;
        const requestRelayout = () => {
            if (rafId !== null) return;
            rafId = window.requestAnimationFrame(() => {
                rafId = null;
                manager.repositionAll();
            });
        };

        manager.repositionAll();

        map.on("move", requestRelayout);
        map.on("zoom", requestRelayout);
        map.on("rotate", requestRelayout);
        map.on("pitch", requestRelayout);
        map.on("resize", requestRelayout);

        return () => {
            if (rafId !== null) {
                window.cancelAnimationFrame(rafId);
            }
            map.off("move", requestRelayout);
            map.off("zoom", requestRelayout);
            map.off("rotate", requestRelayout);
            map.off("pitch", requestRelayout);
            map.off("resize", requestRelayout);
            if (renderMode !== "balloon") {
                manager.clear();
            }
        };
    }, [calloutCandidates, calloutManagerRef, mapRef, onSpotClickRef, onSpotViewRef, renderMode, premiumCacheRef]);

    // Click Handlers
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        const handleSpotClick = (event: mapboxgl.MapLayerMouseEvent) => {
            event.preventDefault();
            const spotId = event.features?.[0]?.properties?.spotId as string | undefined;
            if (spotId) {
                onSpotView?.(spotId);
                onSpotClick?.(spotId);
            }
        };

        const handleClusterClick = (event: mapboxgl.MapLayerMouseEvent) => {
            event.preventDefault();
            const zoom = Math.min(map.getZoom() + 1.5, MAX_ZOOM);
            map.easeTo({ center: event.lngLat, zoom });
        };

        const handleCanvasClick = (event: mapboxgl.MapMouseEvent) => {
            if (renderMode === 'canvas' && fallbackSpots.length > 0) {
                const clickPoint = event.point;
                const CLICK_TOLERANCE = 10;
                let nearestSpot: MapTileFeature | null = null;
                let nearestDistance = CLICK_TOLERANCE;

                fallbackSpots.forEach((feature) => {
                    const spotPoint = map.project([feature.geometry.lng, feature.geometry.lat]);
                    const dx = spotPoint.x - clickPoint.x;
                    const dy = spotPoint.y - clickPoint.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestSpot = feature;
                    }
                });

                if (nearestSpot && nearestSpot.id) {
                    event.preventDefault();
                    onSpotView?.(nearestSpot.id);
                    onSpotClick?.(nearestSpot.id);
                    return;
                }
            }

            const features = map.queryRenderedFeatures(event.point, { layers: INTERACTIVE_LAYERS });
            if (features.length > 0) return;

            if (onSelectLocation) {
                const { lat, lng } = event.lngLat;
                onSelectLocation({ lat, lng });
            }
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
    }, [mapRef, onSpotClick, onSelectLocation, onSpotView, renderMode, fallbackSpots]);

    // Selection Marker
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

    // Focus Coordinates
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
