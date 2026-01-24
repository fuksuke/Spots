import { MutableRefObject, useEffect } from "react";
import mapboxgl, { Map as MapboxMap } from "mapbox-gl";
import type { FeatureCollection, Point } from "geojson";
import { MapTileFeature, MapTileLayer, SpotCategory } from "../../../types";

const TILE_SOURCE_ID = "map-tiles-source";

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

type CanvasRendererParams = {
    mapRef: MutableRefObject<MapboxMap | null>;
    canvasRef: MutableRefObject<HTMLCanvasElement | null>;
    contextRef: MutableRefObject<CanvasRenderingContext2D | null>;
    renderMode: MapTileLayer | "canvas";
    fallbackSpots: MapTileFeature[];
};

export const useCanvasRenderer = ({
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

export const useGeoJsonSource = ({ mapRef, featureCollection, renderMode }: GeoJsonSourceParams) => {
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

export const useCanvasContextSetup = ({
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
