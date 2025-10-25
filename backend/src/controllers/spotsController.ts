import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

import { SPOT_CATEGORY_VALUES } from "../constants/categories.js";
import {
  fetchSpots,
  createSpot,
  fetchSpotById,
  fetchComments,
  createComment,
  likeSpot,
  unlikeSpot,
  fetchPopularSpotsFromLeaderboard
} from "../services/firestoreService.js";
import { PhoneVerificationRequiredError, SchedulingRuleError } from "../services/posterProfileService.js";
import { extractUidFromAuthorization, InvalidAuthTokenError } from "../utils/auth.js";

import { enforceRealtimeSpotWindow } from "./scheduledSpotsController.js";

const listSpotsQuerySchema = z.object({
  category: z.enum(SPOT_CATEGORY_VALUES).optional(),
  followedUserIds: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      return Array.isArray(value)
        ? value.filter(Boolean)
        : value
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
    })
});

const popularSpotsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional()
});

export const listSpotsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, followedUserIds } = listSpotsQuerySchema.parse(req.query);
    let viewerId: string | undefined;
    try {
      const extractedViewerId = await extractUidFromAuthorization(req.headers.authorization);
      viewerId = extractedViewerId ?? undefined;
    } catch (error) {
      if (error instanceof InvalidAuthTokenError) {
        return res.status(401).json({ message: error.message });
      }
      throw error;
    }

    const spots = await fetchSpots({ category, followedUserIds, viewerId });
    res.json(spots);
  } catch (error) {
    if (error instanceof SchedulingRuleError) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

export const popularSpotsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = popularSpotsQuerySchema.parse(req.query);
    let viewerId: string | undefined;
    try {
      const extractedViewerId = await extractUidFromAuthorization(req.headers.authorization);
      viewerId = extractedViewerId ?? undefined;
    } catch (error) {
      if (error instanceof InvalidAuthTokenError) {
        return res.status(401).json({ message: error.message });
      }
      throw error;
    }

    const spots = await fetchPopularSpotsFromLeaderboard(limit ?? 10, viewerId);
    res.json(spots);
  } catch (error) {
    next(error);
  }
};

const createSpotSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(SPOT_CATEGORY_VALUES),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  imageUrl: z.string().url().optional()
});

export const createSpotHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createSpotSchema.parse(req.body);
    const uid = (req as Request & { uid?: string }).uid;
    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }
    await enforceRealtimeSpotWindow(uid, new Date(payload.startTime));
    const spot = await createSpot({ ...payload, ownerId: uid });
    res.status(201).json(spot);
  } catch (error) {
    if (error instanceof PhoneVerificationRequiredError) {
      return res.status(412).json({ message: error.message, code: "PHONE_VERIFICATION_REQUIRED" });
    }
    if (error instanceof SchedulingRuleError) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

export const getSpotDetailHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let viewerId: string | undefined;
    try {
      const extractedViewerId = await extractUidFromAuthorization(req.headers.authorization);
      viewerId = extractedViewerId ?? undefined;
    } catch (error) {
      if (error instanceof InvalidAuthTokenError) {
        return res.status(401).json({ message: error.message });
      }
      throw error;
    }

    const spot = await fetchSpotById(req.params.id, viewerId);
    if (!spot) {
      return res.status(404).json({ message: "Spot not found" });
    }
    res.json(spot);
  } catch (error) {
    next(error);
  }
};

const listCommentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  cursor: z.string().min(1).optional()
});

export const listCommentsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit, cursor } = listCommentsQuerySchema.parse(req.query);
    let viewerId: string | undefined;
    try {
      const extractedViewerId = await extractUidFromAuthorization(req.headers.authorization);
      viewerId = extractedViewerId ?? undefined;
    } catch (error) {
      if (error instanceof InvalidAuthTokenError) {
        return res.status(401).json({ message: error.message });
      }
      throw error;
    }

    const response = await fetchComments(req.params.id, { limit, cursor }, viewerId);
    res.json(response);
  } catch (error) {
    next(error);
  }
};

const createCommentSchema = z.object({
  text: z.string().min(1),
  imageUrl: z.string().url().optional()
});

export const createCommentHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = createCommentSchema.parse(req.body);
    const uid = (req as Request & { uid?: string }).uid;
    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const comment = await createComment(req.params.id, { ...payload, ownerId: uid });
    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
};

export const likeSpotHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as Request & { uid?: string }).uid;
    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const result = await likeSpot(req.params.id, uid);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const unlikeSpotHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as Request & { uid?: string }).uid;
    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const result = await unlikeSpot(req.params.id, uid);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
