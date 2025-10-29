import { useEffect, useMemo, useRef, useState } from "react";

import type { MapTileLayer, MapTileResponse, SpotCategory, TileCoordinate } from "../types";
import { fetchMapTile } from "../lib/mapTileApi";
import { mapTileCache } from "../lib/mapTileCache";
import { mockMapTile } from "../mockData";

const DEFAULT_DEBOUNCE_MS = 150;

export type UseMapTilesOptions = {
  coordinates: TileCoordinate[];
  layer?: MapTileLayer;
  categories?: SpotCategory[];
  premiumOnly?: boolean;
  authToken?: string;
  enabled?: boolean;
};

const isBrowser = typeof window !== "undefined";

const coordinateKey = (coordinate: TileCoordinate) => `${coordinate.z}/${coordinate.x}/${coordinate.y}`;

export const useMapTiles = ({
  coordinates,
  layer,
  categories,
  premiumOnly,
  authToken,
  enabled = true
}: UseMapTilesOptions) => {
  const [tiles, setTiles] = useState<MapTileResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);

  const useMockTiles = import.meta.env.VITE_USE_MOCK_TILES === "true";

  const sortedCoordinates = useMemo(() => {
    return [...coordinates].sort((a, b) => {
      if (a.z !== b.z) return a.z - b.z;
      if (a.x !== b.x) return a.x - b.x;
      return a.y - b.y;
    });
  }, [coordinates]);

  const coordinatesKey = useMemo(() => sortedCoordinates.map((coord) => coordinateKey(coord)).join("|"), [sortedCoordinates]);
  const categoriesKey = useMemo(() => (categories ? categories.join(",") : ""), [categories]);

  const clearPending = () => {
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  useEffect(() => {
    if (!isBrowser || !enabled || sortedCoordinates.length === 0) {
      clearPending();
      setTiles([]);
      setIsLoading(false);
      setError(null);
      return () => undefined;
    }

    let cancelled = false;

    const loadTiles = async () => {
      if (!enabled || sortedCoordinates.length === 0) {
        return;
      }

      clearPending();
      setIsLoading(true);
      setError(null);

      if (useMockTiles) {
        setTiles([mockMapTile as MapTileResponse]);
        setIsLoading(false);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const cachedResults = await Promise.all(
          sortedCoordinates.map((coordinate) => mapTileCache.get(coordinate))
        );

        if (!cancelled) {
          const orderedCached = sortedCoordinates
            .map((coord, index) => cachedResults[index] ?? null)
            .filter((tile): tile is MapTileResponse => Boolean(tile));
          if (orderedCached.length > 0) {
            setTiles(orderedCached);
          }
        }

        const freshResults = await Promise.all(
          sortedCoordinates.map((coordinate, index) =>
            fetchMapTile(coordinate, {
              layer,
              categories,
              premiumOnly,
              authToken,
              since: cachedResults[index]?.generatedAt,
              previous: cachedResults[index] ?? undefined,
              signal: controller.signal
            })
          )
        );

        if (!cancelled) {
          setTiles(freshResults);
        }
      } catch (requestError) {
        if (!cancelled && (requestError as Error)?.name !== "AbortError") {
          setError(requestError as Error);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
        abortRef.current = null;
      }
    };

    debounceRef.current = window.setTimeout(() => {
      void loadTiles();
    }, DEFAULT_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearPending();
    };
  }, [sortedCoordinates, coordinatesKey, categoriesKey, categories, layer, premiumOnly, authToken, enabled, useMockTiles]);

  return {
    tiles,
    isLoading,
    error
  };
};
