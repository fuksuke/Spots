import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

import { SPOT_CATEGORY_VALUES } from "../constants/categories.js";
import { getMapTile } from "../services/mapTileService.js";
import { extractUidFromAuthorization, InvalidAuthTokenError } from "../utils/auth.js";

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

export const getMapTileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { z, x, y } = paramsSchema.parse(req.params);
    const { layer, categories, premiumOnly, since } = querySchema.parse(req.query);

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

    const response = await getMapTile(z, x, y, {
      layer,
      categories,
      premiumOnly,
      since,
      viewerId
    });

    res.setHeader("Cache-Control", viewerId ? "private, max-age=30" : "public, max-age=30, stale-while-revalidate=120");
    res.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.issues[0]?.message ?? "Invalid request" });
    }
    next(error);
  }
};
