import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { z } from "zod";

import { SPOT_CATEGORY_VALUES } from "../constants/categories.js";
import { getMapTile, type MapTileResponse } from "../services/mapTileService.js";
import { extractUidFromAuthorization, InvalidAuthTokenError } from "../utils/auth.js";

const MAX_BATCH_SIZE = 16;

const paramsSchema = z.object({
  z: z.coerce.number().int(),
  x: z.coerce.number().int(),
  y: z.coerce.number().int()
});

const layerSchema = z.enum(["cluster", "pulse", "balloon"]);

const categoriesTransform = z
  .union([
    z.string(),
    z.array(z.enum(SPOT_CATEGORY_VALUES))
  ])
  .transform((raw) => {
    if (Array.isArray(raw)) {
      return raw;
    }
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter((value): value is typeof SPOT_CATEGORY_VALUES[number] => SPOT_CATEGORY_VALUES.includes(value as typeof SPOT_CATEGORY_VALUES[number]));
  });

const querySchema = z.object({
  layer: layerSchema.optional(),
  categories: categoriesTransform.optional(),
  premiumOnly: z.coerce.boolean().optional(),
  since: z.coerce.number().min(0).optional()
});

const batchRequestSchema = z.object({
  tiles: z.array(z.object({
    z: z.number().int(),
    x: z.number().int(),
    y: z.number().int(),
    since: z.number().min(0).optional(),
    etag: z.string().optional()
  })).min(1).max(MAX_BATCH_SIZE),
  layer: layerSchema.optional(),
  categories: z.array(z.enum(SPOT_CATEGORY_VALUES)).optional(),
  premiumOnly: z.boolean().optional()
});

const generateETag = (response: MapTileResponse): string => {
  const content = JSON.stringify({
    features: response.features,
    generatedAt: response.generatedAt
  });
  return crypto.createHash("md5").update(content).digest("hex");
};

export const getMapTileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { z: tileZ, x, y } = paramsSchema.parse(req.params);
    const { layer, categories, premiumOnly, since } = querySchema.parse(req.query);
    const ifNoneMatch = req.headers["if-none-match"];

    let viewerId: string | undefined;
    try {
      const resolved = await extractUidFromAuthorization(req.headers.authorization ?? undefined);
      viewerId = resolved ?? undefined;
    } catch (error) {
      if (error instanceof InvalidAuthTokenError) {
        return res.status(401).json({ message: error.message });
      }
      throw error;
    }

    const response = await getMapTile(tileZ, x, y, {
      layer,
      categories,
      premiumOnly,
      since,
      viewerId
    });

    const etag = generateETag(response);

    // Check If-None-Match for 304 response
    if (ifNoneMatch && ifNoneMatch === etag) {
      res.setHeader("ETag", etag);
      res.setHeader("Cache-Control", viewerId ? "private, max-age=30" : "public, max-age=30, stale-while-revalidate=120");
      return res.status(304).end();
    }

    res.setHeader("ETag", etag);
    res.setHeader("Cache-Control", viewerId ? "private, max-age=30" : "public, max-age=30, stale-while-revalidate=120");
    res.json({ ...response, etag });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message ?? "Invalid request" });
    }
    next(error);
  }
};

export const getMapTilesBatchHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tiles, layer, categories, premiumOnly } = batchRequestSchema.parse(req.body);

    let viewerId: string | undefined;
    try {
      const resolved = await extractUidFromAuthorization(req.headers.authorization ?? undefined);
      viewerId = resolved ?? undefined;
    } catch (error) {
      if (error instanceof InvalidAuthTokenError) {
        return res.status(401).json({ message: error.message });
      }
      throw error;
    }

    const results = await Promise.all(
      tiles.map(async (tile) => {
        const response = await getMapTile(tile.z, tile.x, tile.y, {
          layer,
          categories,
          premiumOnly,
          since: tile.since,
          viewerId
        });

        const etag = generateETag(response);

        // Check if client's ETag matches (304 Not Modified)
        if (tile.etag && tile.etag === etag) {
          return {
            z: tile.z,
            x: tile.x,
            y: tile.y,
            generatedAt: response.generatedAt,
            nextSyncAt: response.nextSyncAt,
            domBudget: response.domBudget,
            features: [],
            notModified: true,
            etag
          };
        }

        return { ...response, etag };
      })
    );

    res.setHeader("Cache-Control", viewerId ? "private, max-age=30" : "public, max-age=30, stale-while-revalidate=120");
    res.json({
      tiles: results,
      batchGeneratedAt: Date.now()
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message ?? "Invalid request" });
    }
    next(error);
  }
};
