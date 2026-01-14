import { createHash } from "node:crypto";

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
  fetchPopularSpotsFromLeaderboard,
  fetchTrendingNewSpots,
  recordSpotView
} from "../services/firestoreService.js";
import { createSpotReport } from "../services/spotReportService.js";
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

const recordSpotViewBodySchema = z
  .object({
    sessionId: z.string().min(8).max(160).optional()
  })
  .optional();

const spotReportBodySchema = z.object({
  reason: z.enum(["fraud", "spam", "inappropriate", "other"]),
  details: z.string().min(0).max(400).optional()
});

const hashViewerKey = (value: string) => createHash("sha256").update(value).digest("hex");

const resolveViewerHash = (req: Request, viewerId?: string | null, sessionId?: string | null) => {
  if (viewerId) {
    return hashViewerKey(`uid:${viewerId}`);
  }
  if (sessionId) {
    return hashViewerKey(`session:${sessionId}`);
  }
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ipCandidate = forwardedValue?.split(",").map((item) => item.trim()).filter(Boolean)[0];
  const fallbackIp = ipCandidate || req.socket.remoteAddress || req.ip;
  if (fallbackIp) {
    return hashViewerKey(`ip:${fallbackIp}`);
  }
  return null;
};

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

const trendingNewSpotsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).optional()
});

export const trendingNewSpotsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = trendingNewSpotsQuerySchema.parse(req.query);
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

    const spots = await fetchTrendingNewSpots(limit ?? 10, viewerId);
    res.json(spots);
  } catch (error) {
    next(error);
  }
};

export const recordSpotViewHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = recordSpotViewBodySchema.parse(req.body);
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

    const viewerHash = resolveViewerHash(req, viewerId, body?.sessionId ?? null);
    if (!viewerHash) {
      return res.status(400).json({ message: "視聴セッションを特定できませんでした" });
    }

    const result = await recordSpotView(req.params.id, viewerHash);
    res.status(result.recorded ? 201 : 200).json(result);
  } catch (error) {
    next(error);
  }
};

export const reportSpotHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason, details } = spotReportBodySchema.parse(req.body);
    let reporterUid: string | null = null;
    try {
      const extracted = await extractUidFromAuthorization(req.headers.authorization);
      reporterUid = extracted ?? null;
    } catch (error) {
      if (!(error instanceof InvalidAuthTokenError)) {
        throw error;
      }
    }

    await createSpotReport({
      spotId: req.params.id,
      reporterUid,
      reason,
      details: details?.trim() ? details.trim() : null
    });

    res.status(201).json({ status: "ok" });
  } catch (error) {
    next(error);
  }
};

const phoneNumberSchema = z.string()
  .optional()
  .refine(
    (val) => {
      if (!val) return true;
      const normalized = val.replace(/[^0-9]/g, '');
      // 携帯: 070/080/090 + 8桁 = 11桁
      if (/^(070|080|090)\d{8}$/.test(normalized)) return true;
      // 固定: 0 + 9桁 = 10桁
      if (/^0[1-9]\d{8}$/.test(normalized)) return true;
      // フリーダイヤル: 0120 + 6桁 = 10桁
      if (/^0120\d{6}$/.test(normalized)) return true;
      return false;
    },
    { message: "電話番号の形式が正しくありません（10桁または11桁で入力してください）" }
  );

const createSpotSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  speechBubble: z.string().min(1).max(20),
  category: z.enum(SPOT_CATEGORY_VALUES),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  imageUrl: z.string().url().optional(),
  contact: z.object({
    phone: phoneNumberSchema,
    email: z.string().email("有効なメールアドレスを入力してください").optional()
  }).optional(),
  locationDetails: z.string().optional(),
  externalLinks: z.array(z.object({
    label: z.string(),
    url: z.string().url()
  })).optional(),
  hashtags: z.string().optional()
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
