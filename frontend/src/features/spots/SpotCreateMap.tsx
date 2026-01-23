import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Coordinates } from "../../types";

type SpotCreateMapProps = {
  value: Coordinates | null;
  onChange: (coords: Coordinates) => void;
  initialView?: { latitude: number; longitude: number; zoom: number };
  searchQuery?: string;
  onSearchResults?: (results: Array<{ label: string; coordinates: Coordinates }>) => void;
};

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

export const SpotCreateMap = ({ value, onChange, initialView }: SpotCreateMapProps) => {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const changeHandlerRef = useRef(onChange);
  const initialViewRef = useRef(initialView);
  const markerDragHandlerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    changeHandlerRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (initialView) {
      initialViewRef.current = initialView;
    }
  }, [initialView]);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    const view = initialViewRef.current;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [view?.longitude ?? 139.7016, view?.latitude ?? 35.6595],
      zoom: view?.zoom ?? 14,
      attributionControl: false
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), "top-right");

    const handleClick = (event: mapboxgl.MapMouseEvent) => {
      const coords: Coordinates = { lat: event.lngLat.lat, lng: event.lngLat.lng };
      changeHandlerRef.current?.(coords);
    };

    map.on("click", handleClick);
    mapRef.current = map;

    return () => {
      map.off("click", handleClick);
      if (markerRef.current) {
        if (markerDragHandlerRef.current) {
          markerRef.current.off("dragend", markerDragHandlerRef.current);
          markerDragHandlerRef.current = null;
        }
        markerRef.current.remove();
        markerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!value) {
      if (markerRef.current) {
        if (markerDragHandlerRef.current) {
          markerRef.current.off("dragend", markerDragHandlerRef.current);
          markerDragHandlerRef.current = null;
        }
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    if (!markerRef.current) {
      const marker = new mapboxgl.Marker({ color: "#14b8a6", draggable: true });
      const handleDragEnd = () => {
        const lngLat = marker.getLngLat();
        changeHandlerRef.current?.({ lat: lngLat.lat, lng: lngLat.lng });
      };
      marker.on("dragend", handleDragEnd);
      marker.setLngLat([value.lng, value.lat]).addTo(map);
      markerRef.current = marker;
      markerDragHandlerRef.current = handleDragEnd;
    } else {
      markerRef.current.setLngLat([value.lng, value.lat]);
    }
    map.flyTo({ center: [value.lng, value.lat], zoom: Math.max(map.getZoom(), 15), speed: 1.5 });
  }, [value]);

  return <div className="spot-create-map" ref={containerRef} />;
};
