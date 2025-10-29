import { openDB, type IDBPDatabase } from "idb";

import type { MapTileResponse, TileCoordinate } from "../types";

const DB_NAME = "spots-map-tiles";
const DB_VERSION = 1;
const STORE_NAME = "tiles";
const MAX_MEMORY_ENTRIES = 200;

const isBrowser = typeof window !== "undefined";

const memoryCache = new Map<string, MapTileResponse>();

let dbPromise: Promise<IDBPDatabase<{ tiles: { key: string; value: MapTileResponse } }>> | null = null;

const createKey = ({ z, x, y }: TileCoordinate) => `${z}/${x}/${y}`;

const ensureCapacity = () => {
  if (memoryCache.size <= MAX_MEMORY_ENTRIES) return;
  const oldestKey = memoryCache.keys().next().value;
  if (oldestKey) {
    memoryCache.delete(oldestKey);
  }
};

const getDb = async () => {
  if (!isBrowser || typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      }
    });
  }
  return dbPromise;
};

export const mapTileCache = {
  createKey,
  async get(coordinate: TileCoordinate, minGeneratedAt?: number) {
    const key = createKey(coordinate);
    const memoryHit = memoryCache.get(key);
    if (memoryHit && (!minGeneratedAt || memoryHit.generatedAt >= minGeneratedAt)) {
      return memoryHit;
    }

    const db = await getDb();
    if (!db) {
      return memoryHit ?? null;
    }

    const record = await db.get(STORE_NAME, key);
    if (!record) {
      return memoryHit ?? null;
    }

    if (minGeneratedAt && record.generatedAt < minGeneratedAt) {
      return memoryHit ?? null;
    }

    memoryCache.set(key, record);
    ensureCapacity();
    return record;
  },
  async set(coordinate: TileCoordinate, response: MapTileResponse) {
    const key = createKey(coordinate);
    memoryCache.set(key, response);
    ensureCapacity();

    const db = await getDb();
    if (!db) return;
    try {
      await db.put(STORE_NAME, response, key);
    } catch (error) {
      console.warn("Failed to persist map tile", error);
    }
  },
  async clear() {
    memoryCache.clear();
    const db = await getDb();
    if (!db) return;
    await db.clear(STORE_NAME);
  },
  clearMemory() {
    memoryCache.clear();
  }
};

export type { MapTileResponse } from "../types";
