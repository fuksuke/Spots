import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Mapbox Token (should be in env, but for now assuming it's set globally or here)
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || "pk.eyJ1IjoiZnVrc3VrZSIsImEiOiJjbTVnOHV0NmswNnJpMmtvY3Z4c3B0cm82In0.D4fVlqGjJaeo5-l7UoN64g";

type GlobalMapContextType = {
    map: mapboxgl.Map | null;
    attach: (container: HTMLElement) => void;
    detach: () => void;
    isReady: boolean;
};

const GlobalMapContext = createContext<GlobalMapContextType | null>(null);

export const useGlobalMap = () => {
    const context = useContext(GlobalMapContext);
    if (!context) {
        throw new Error("useGlobalMap must be used within a GlobalMapProvider");
    }
    return context;
};

export const GlobalMapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
    const [isReady, setIsReady] = useState(false);

    // Initialize Map immediately on mount (once per session)
    useEffect(() => {
        if (mapInstanceRef.current) return;

        // Create a hidden container for the map
        const container = document.createElement("div");
        container.style.position = "absolute";
        container.style.width = "100%";
        container.style.height = "100%";
        container.style.top = "-9999px"; // Hide off-screen initially
        container.style.left = "-9999px";
        container.id = "global-map-container";
        document.body.appendChild(container);
        mapContainerRef.current = container;

        console.log("[GlobalMapProvider] Initializing Mapbox instance...");
        const map = new mapboxgl.Map({
            container,
            style: "mapbox://styles/mapbox/streets-v12",
            center: [139.700571, 35.659108], // Default Shibuya
            zoom: 14,
            projection: "mercator"
        });

        map.addControl(new mapboxgl.NavigationControl(), "top-right");

        map.once("load", () => {
            console.log("[GlobalMapProvider] Map loaded.");
            setIsReady(true);
        });

        mapInstanceRef.current = map;

        return () => {
            // Cleanup (never happens in SPA usually, but for hot reload)
            console.log("[GlobalMapProvider] Disposing map.");
            map.remove();
            if (document.body.contains(container)) {
                document.body.removeChild(container);
            }
            mapInstanceRef.current = null;
        };
    }, []);

    const attach = (targetContainer: HTMLElement) => {
        const map = mapInstanceRef.current;
        const sourceContainer = mapContainerRef.current;
        if (!map || !sourceContainer) return;

        console.log("[GlobalMapProvider] Attaching map to view.");

        // Move the canvas/container to the target
        // We move the CONTENTS of mapContainerRef to targetContainer?
        // Mapbox expects 'container' to be the one passed in constructor.
        // If we passed 'container' (created above), we should move THAT container into targetContainer.

        // Reset styles that hid it
        sourceContainer.style.position = "absolute";
        sourceContainer.style.top = "0";
        sourceContainer.style.left = "0";
        sourceContainer.style.width = "100%";
        sourceContainer.style.height = "100%";

        // Append the map's container to the target
        if (sourceContainer.parentElement !== targetContainer) {
            targetContainer.appendChild(sourceContainer);
            map.resize(); // Trigger resize to fit new container
        }
    };

    const detach = () => {
        const sourceContainer = mapContainerRef.current;
        if (!sourceContainer) return;

        console.log("[GlobalMapProvider] Detaching map (hiding).");
        // Move back to body and hide
        if (sourceContainer.parentElement !== document.body) {
            sourceContainer.style.top = "-9999px";
            sourceContainer.style.left = "-9999px";
            document.body.appendChild(sourceContainer);
        }
    };

    return (
        <GlobalMapContext.Provider value={{ map: mapInstanceRef.current, attach, detach, isReady }}>
            {children}
        </GlobalMapContext.Provider>
    );
};
