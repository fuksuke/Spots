import { openDB, type IDBPDatabase } from "idb";

import type { MapTileResponse, TileCoordinate } from "../types";

const DB_NAME = "spots-map-tiles";
const DB_VERSION = 2;
const STORE_NAME = "tiles";
const MAX_MEMORY_ENTRIES = 200;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

const isBrowser = typeof window !== "undefined";

type TileRecord = MapTileResponse & {
  cachedAt: number;
  etag?: string;
};

const memoryCache = new Map<string, TileRecord>();

let dbPromise: Promise<IDBPDatabase<{ tiles: { key: string; value: TileRecord } }>> | null = null;

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
    dbPromise = openDB<{ tiles: { key: string; value: TileRecord } }>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion) {
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
        // Migration from v1 to v2: old entries will be cleaned up on next access
      }
    });
  }
  return dbPromise;
};

const isExpired = (cachedAt: number | undefined): boolean => {
  if (cachedAt === undefined) return true;
  return Date.now() - cachedAt > TTL_MS;
};

export const mapTileCache = {
  createKey,
  async get(coordinate: TileCoordinate, minGeneratedAt?: number): Promise<MapTileResponse | null> {
    const key = createKey(coordinate);
    const memoryHit = memoryCache.get(key);

    // Check TTL for memory cache
    if (memoryHit) {
      if (isExpired(memoryHit.cachedAt)) {
        memoryCache.delete(key);
      } else if (!minGeneratedAt || memoryHit.generatedAt >= minGeneratedAt) {
        return memoryHit;
      }
    }

    const db = await getDb();
    if (!db) {
      return null;
    }

    const record = await db.get(STORE_NAME, key);
    if (!record) {
      return null;
    }

    // Check TTL for IndexedDB cache
    if (isExpired(record.cachedAt)) {
      try {
        await db.delete(STORE_NAME, key);
      } catch {
        // Ignore deletion errors
      }
      return null;
    }

    if (minGeneratedAt && record.generatedAt < minGeneratedAt) {
      return null;
    }

    memoryCache.set(key, record);
    ensureCapacity();
    return record;
  },
  async set(coordinate: TileCoordinate, response: MapTileResponse, etag?: string) {
    const key = createKey(coordinate);
    const record: TileRecord = {
      ...response,
      cachedAt: Date.now(),
      etag
    };
    memoryCache.set(key, record);
    ensureCapacity();

    const db = await getDb();
    if (!db) return;
    try {
      await db.put(STORE_NAME, record, key);
    } catch (error) {
      console.warn("Failed to persist map tile", error);
    }
  },
  async getETag(coordinate: TileCoordinate): Promise<string | undefined> {
    const key = createKey(coordinate);
    const memoryHit = memoryCache.get(key);
    if (memoryHit && !isExpired(memoryHit.cachedAt)) {
      return memoryHit.etag;
    }

    const db = await getDb();
    if (!db) return undefined;

    const record = await db.get(STORE_NAME, key);
    if (!record || isExpired(record.cachedAt)) {
      return undefined;
    }
    return record.etag;
  },
  async cleanup() {
    const db = await getDb();
    if (!db) return;

    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      let cursor = await store.openCursor();
      const keysToDelete: string[] = [];

      while (cursor) {
        const record = cursor.value;
        if (isExpired(record.cachedAt)) {
          keysToDelete.push(cursor.key as string);
        }
        cursor = await cursor.continue();
      }

      for (const key of keysToDelete) {
        await store.delete(key);
      }

      await tx.done;

      if (keysToDelete.length > 0) {
        console.debug(`[mapTileCache] Cleaned up ${keysToDelete.length} expired entries`);
      }
    } catch (error) {
      console.warn("Failed to cleanup expired tiles", error);
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
  },
  async has(coordinate: TileCoordinate): Promise<boolean> {
    const cached = await this.get(coordinate);
    return cached !== null;
  }
};

export type { MapTileResponse } from "../types";
