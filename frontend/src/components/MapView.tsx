import { useCallback, useEffect, useRef } from "react";
import mapboxgl, { Map } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Coordinates, Spot } from "../types";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

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
};

export const MapView = ({
  initialView,
  spots = [],
  selectedLocation,
  onSelectLocation,
  focusCoordinates,
  onSpotClick
}: MapViewProps) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const selectionMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

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

      map.once("load", () => {
        map.resize();
      });
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
  }, [initialView, syncContainerSize]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.resize();
  }, [spots.length, selectedLocation, focusCoordinates]);

  useEffect(() => {
    const handleResize = () => {
      syncContainerSize();
      const map = mapRef.current;
      if (map) {
        map.resize();
      }
    };
    syncContainerSize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [syncContainerSize]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sourceId = "spots-source";
    const layerId = "spots-layer";

    const updateSources = () => {
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: []
          }
        });
        map.addLayer({
          id: layerId,
          type: "circle",
          source: sourceId,
          paint: {
            "circle-color": [
              "match",
              ["get", "category"],
              "live",
              "#ef4444",
              "event",
              "#f59e0b",
              "cafe",
              "#10b981",
              "coupon",
              "#8b5cf6",
              "sports",
              "#3b82f6",
              "#6366f1"
            ],
            "circle-radius": 8,
            "circle-opacity": 0.85,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#0f172a"
          }
        });
      }

      const source = map.getSource(sourceId) as mapboxgl.GeoJSONSource | undefined;
      if (!source) return;

      const featureCollection = {
        type: "FeatureCollection" as const,
        features: spots.map((spot) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [spot.lng, spot.lat]
          },
          properties: {
            id: spot.id,
            title: spot.title,
            category: spot.category
          }
        }))
      };

      source.setData(featureCollection);
    };

    if (map.isStyleLoaded()) {
      updateSources();
    } else {
      map.once("styledata", updateSources);
      return () => {
        map.off("styledata", updateSources);
      };
    }
  }, [spots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layerId = "spots-layer";

    const handleClick = (event: mapboxgl.MapMouseEvent) => {
      if (!onSpotClick) return;
      const features = map.queryRenderedFeatures(event.point, { layers: [layerId] });
      const first = features[0];
      const spotId = first?.properties?.id as string | undefined;
      if (spotId) {
        onSpotClick(spotId);
      }
    };

    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", layerId, handleClick);
    map.on("mouseenter", layerId, handleMouseEnter);
    map.on("mouseleave", layerId, handleMouseLeave);

    return () => {
      map.off("click", layerId, handleClick);
      map.off("mouseenter", layerId, handleMouseEnter);
      map.off("mouseleave", layerId, handleMouseLeave);
    };
  }, [onSpotClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onSelectLocation) return;

    const handleClick = (event: mapboxgl.MapMouseEvent) => {
      const { lat, lng } = event.lngLat;
      onSelectLocation({ lat, lng });
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [onSelectLocation]);

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
