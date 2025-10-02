import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl from "mapbox-gl";
import { initSentry } from "./lib/sentry";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN!;

initSentry();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
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
