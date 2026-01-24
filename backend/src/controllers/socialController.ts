import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { limitSchema, idParamSchema } from "../schemas/common.js";
import {
  followUser,
  fetchFollowedSpots,
  favoriteSpot,
  likeComment,
  likeSpot,
  unfavoriteSpot,
  unfollowUser,
  unlikeComment,
  unlikeSpot
} from "../services/firestoreService.js";

const likePayloadSchema = z
  .object({
    spot_id: z.string().min(1).optional(),
    spotId: z.string().min(1).optional(),
    user_id: z.string().optional(),
    userId: z.string().optional()
  })
  .refine((payload) => Boolean(payload.spot_id ?? payload.spotId), {
    message: "spot_id is required"
  })
  .transform((payload) => ({
    spotId: (payload.spot_id ?? payload.spotId) as string,
    requestUserId: payload.user_id ?? payload.userId
  }));

const followPayloadSchema = z
  .object({
    target_user_id: z.string().min(1).optional(),
    targetUserId: z.string().min(1).optional()
  })
  .refine((payload) => Boolean(payload.target_user_id ?? payload.targetUserId), {
    message: "target_user_id is required"
  })
  .transform((payload) => ({
    targetUserId: (payload.target_user_id ?? payload.targetUserId) as string
  }));

const followedPostsQuerySchema = z.object({
  limit: limitSchema(50)
});

const commentLikeParamsSchema = idParamSchema;

export const likeSpotActionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { spotId, requestUserId } = likePayloadSchema.parse(req.body ?? {});
    const uid = (req as Request & { uid?: string }).uid;

    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (requestUserId && requestUserId !== uid) {
      return res.status(403).json({ message: "User mismatch" });
    }

    const result = await likeSpot(spotId, uid);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const unlikeSpotActionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { spotId, requestUserId } = likePayloadSchema.parse(req.body ?? {});
    const uid = (req as Request & { uid?: string }).uid;

    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (requestUserId && requestUserId !== uid) {
      return res.status(403).json({ message: "User mismatch" });
    }

    const result = await unlikeSpot(spotId, uid);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const favoriteSpotActionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { spotId } = likePayloadSchema.parse(req.body ?? {});
    const uid = (req as Request & { uid?: string }).uid;

    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await favoriteSpot(spotId, uid);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const unfavoriteSpotActionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { spotId } = likePayloadSchema.parse(req.body ?? {});
    const uid = (req as Request & { uid?: string }).uid;

    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await unfavoriteSpot(spotId, uid);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const likeCommentActionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: commentId } = commentLikeParamsSchema.parse(req.params);
    const uid = (req as Request & { uid?: string }).uid;

    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await likeComment(commentId, uid);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const unlikeCommentActionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id: commentId } = commentLikeParamsSchema.parse(req.params);
    const uid = (req as Request & { uid?: string }).uid;

    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await unlikeComment(commentId, uid);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const followUserActionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { targetUserId } = followPayloadSchema.parse(req.body ?? {});
    const uid = (req as Request & { uid?: string }).uid;

    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await followUser(uid, targetUserId);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("yourself")) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

export const unfollowUserActionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { targetUserId } = followPayloadSchema.parse(req.body ?? {});
    const uid = (req as Request & { uid?: string }).uid;

    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const result = await unfollowUser(uid, targetUserId);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("yourself")) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

export const followedPostsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit } = followedPostsQuerySchema.parse(req.query);
    const uid = (req as Request & { uid?: string }).uid;

    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const spots = await fetchFollowedSpots(uid, { limit });
    res.json(spots);
  } catch (error) {
    next(error);
  }
};
