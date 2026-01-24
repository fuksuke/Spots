import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./providers/AuthProvider";
import "./styles/base.css";
import "./styles/trending-refined.css";
import "./styles/spots-brand.css";
import "./styles/components/MapView.css";
import "./styles/components/SpotListView.css";
import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";
import { initSentry } from "./lib/sentry";
import { BrowserRouter } from "react-router-dom";

import { GlobalMapProvider } from "./features/map/GlobalMapProvider";
import { mapTileCache } from "./lib/mapTileCache";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN!;

initSentry();

// Cleanup expired cache entries on startup
mapTileCache.cleanup().catch((error) => {
  console.warn("Failed to cleanup map tile cache", error);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <GlobalMapProvider>
          <App />
        </GlobalMapProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => {
        console.warn('Service worker registration failed', error);
      });
  });
}
