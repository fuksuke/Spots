import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        "/api": {
          target: env.VITE_API_BASE ?? "http://localhost:4000",
          changeOrigin: true
        }
      }
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            mapbox: ["mapbox-gl"],
            firebase: ["firebase/app", "firebase/auth", "firebase/firestore", "firebase/storage"]
          }
        }
      },
      chunkSizeWarningLimit: 2000
    }
  };
});
