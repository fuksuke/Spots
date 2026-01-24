import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

import { SPOT_CATEGORY_VALUES } from "../constants/categories.js";
import { REVIEW_TEMPLATES } from "../constants/moderation.js";
import { firebaseAuth } from "../services/firebaseAdmin.js";
import {
  getPosterProfile,
  SchedulingRuleError,
  assertRealtimePostWindow,
  PhoneVerificationRequiredError
} from "../services/posterProfileService.js";
import type { ScheduledSpot, AnnouncementType, ScheduledSpotReviewLog } from "../services/scheduledSpotService.js";
import {
  cancelScheduledSpot,
  createScheduledSpot,
  listScheduledSpotsForAdmin,
  listScheduledSpotsForUser,
  listScheduledSpotReviewLogs,
  reviewScheduledSpot,
  updateScheduledSpot
} from "../services/scheduledSpotService.js";
import { notifyAdminOfPendingSpot } from "../services/notificationService.js";
import { ensureAdmin } from "../utils/admin.js";

const announcementTypeSchema = z.enum(["short_term_notice", "long_term_campaign"]);

const pricingSchema = z.object({
  label: z.string().max(50).optional(),
  amount: z.number().nonnegative().optional(),
  currency: z.string().max(10).optional(),
  isFree: z.boolean()
}).nullable().optional();

const contactSchema = z.object({
  phone: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional(),
  sns: z.record(z.string()).nullable().optional()
}).nullable().optional();

const externalLinkSchema = z.object({
  label: z.string().max(50),
  url: z.string().url(),
  icon: z.string().max(50).nullable().optional()
});

const scheduledSpotPayloadSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(1000),
  category: z.enum(SPOT_CATEGORY_VALUES),
  lat: z.number(),
  lng: z.number(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  publishAt: z.string().datetime(),
  announcementType: announcementTypeSchema,
  imageUrl: z.string().url().nullable().optional(),
  speechBubble: z.string().max(100).nullable().optional(),
  locationName: z.string().max(100).nullable().optional(),
  locationDetails: z.string().max(200).nullable().optional(),
  pricing: pricingSchema,
  contact: contactSchema,
  externalLinks: z.array(externalLinkSchema).max(10).nullable().optional(),
  ownerDisplayName: z.string().max(100).nullable().optional(),
  ownerPhotoUrl: z.string().url().nullable().optional()
});

const updateScheduledSpotSchema = scheduledSpotPayloadSchema.partial();

const reviewScheduledSpotSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNotes: z.string().max(300).optional(),
  templateId: z.string().max(64).optional(),
  promotion: z
    .object({
      headline: z.string().max(140).optional(),
      ctaUrl: z.string().url().nullable().optional(),
      imageUrl: z.string().url().nullable().optional(),
      priority: z.number().int().optional(),
      expiresAt: z.string().datetime().optional()
    })
    .nullable()
    .optional()
});

export const createScheduledSpotHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as Request & { uid?: string }).uid;
    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const payload = scheduledSpotPayloadSchema.parse(req.body);
    const poster = await getPosterProfile(uid);
    if (!poster.phoneVerified) {
      throw new PhoneVerificationRequiredError("スポットを投稿するにはSMS本人認証が必要です。");
    }

    const input = {
      title: payload.title,
      description: payload.description,
      category: payload.category,
      lat: payload.lat,
      lng: payload.lng,
      startTime: new Date(payload.startTime),
      endTime: new Date(payload.endTime),
      publishAt: new Date(payload.publishAt),
      ownerId: uid,
      announcementType: payload.announcementType as AnnouncementType,
      imageUrl: payload.imageUrl ?? null,
      speechBubble: payload.speechBubble ?? null,
      locationName: payload.locationName ?? null,
      locationDetails: payload.locationDetails ?? null,
      pricing: payload.pricing ?? null,
      contact: payload.contact ?? null,
      externalLinks: payload.externalLinks ?? null,
      ownerDisplayName: payload.ownerDisplayName ?? null,
      ownerPhotoUrl: payload.ownerPhotoUrl ?? null
    } satisfies Parameters<typeof createScheduledSpot>[0];

    const spot = await createScheduledSpot(input, poster);

    // Notify admin if the spot requires manual review
    if (spot.status === "pending") {
      notifyAdminOfPendingSpot(spot.id, spot.title).catch((err) => {
        console.error("Failed to notify admin of pending spot:", err);
      });
    }

    res.status(201).json(toApiSpot(spot));
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

export const updateScheduledSpotHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as Request & { uid?: string }).uid;
    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const payload = updateScheduledSpotSchema.parse(req.body);
    const poster = await getPosterProfile(uid);
    if (!poster.phoneVerified) {
      throw new PhoneVerificationRequiredError("スポットを更新するにはSMS本人認証が必要です。");
    }

    const updated = await updateScheduledSpot(
      req.params.id,
      uid,
      {
        ...payload,
        startTime: payload.startTime ? new Date(payload.startTime) : undefined,
        endTime: payload.endTime ? new Date(payload.endTime) : undefined,
        publishAt: payload.publishAt ? new Date(payload.publishAt) : undefined,
        announcementType: payload.announcementType as AnnouncementType | undefined
      },
      poster
    );
    res.json(toApiSpot(updated));
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

export const cancelScheduledSpotHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as Request & { uid?: string }).uid;
    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const isAdmin = (req as Request & { isAdmin?: boolean }).isAdmin;
    await cancelScheduledSpot(req.params.id, { uid, isAdmin });
    res.status(204).end();
  } catch (error) {
    if (error instanceof SchedulingRuleError) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

export const listScheduledSpotsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as Request & { uid?: string }).uid;
    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const spots = await listScheduledSpotsForUser(uid);
    res.json(spots.map(toApiSpot));
  } catch (error) {
    next(error);
  }
};

const adminListQuerySchema = z.object({
  status: z.enum(["pending", "approved", "published", "rejected", "cancelled"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  ownerId: z.string().optional(),
  publishStart: z.string().datetime().optional(),
  publishEnd: z.string().datetime().optional()
});

export const listScheduledSpotsForAdminHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    ensureAdmin(req);
    const { status, limit, ownerId, publishStart, publishEnd } = adminListQuerySchema.parse(req.query);
    const spots = await listScheduledSpotsForAdmin({
      status: status as ScheduledSpot["status"] | undefined,
      limit,
      ownerId,
      publishStart: publishStart ? new Date(publishStart) : undefined,
      publishEnd: publishEnd ? new Date(publishEnd) : undefined
    });
    res.json(spots.map(toApiSpot));
  } catch (error) {
    if (error instanceof SchedulingRuleError) {
      return res.status(403).json({ message: error.message });
    }
    next(error);
  }
};

export const listReviewTemplatesHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    ensureAdmin(req);
    res.json(REVIEW_TEMPLATES);
  } catch (error) {
    if (error instanceof SchedulingRuleError) {
      return res.status(403).json({ message: error.message });
    }
    next(error);
  }
};

const adminLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  format: z.enum(["json", "csv"]).optional()
});

export const listScheduledSpotReviewLogsHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    ensureAdmin(req);
    const { limit, format } = adminLogQuerySchema.parse(req.query);
    const logs = await listScheduledSpotReviewLogs(req.params.id, limit);

    if (format === "csv") {
      const header = ["createdAt", "actorUid", "actorEmail", "previousStatus", "nextStatus", "reviewNotes"];
      const lines = logs.map((log) =>
        [
          log.createdAt,
          log.actorUid,
          log.actorEmail ?? "",
          log.previousStatus,
          log.nextStatus,
          (log.reviewNotes ?? "").replace(/"/g, '""')
        ].map((value) => `"${String(value)}"`).join(",")
      );
      const csv = [header.join(","), ...lines].join("\n");
      res.type("text/csv").send(csv);
      return;
    }

    res.json(logs as ScheduledSpotReviewLog[]);
  } catch (error) {
    if (error instanceof SchedulingRuleError) {
      return res.status(403).json({ message: error.message });
    }
    next(error);
  }
};

export const reviewScheduledSpotHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const adminUid = ensureAdmin(req);
    const payload = reviewScheduledSpotSchema.parse(req.body);

    if (payload.status === "rejected") {
      if (!payload.reviewNotes || payload.reviewNotes.trim().length === 0) {
        throw new SchedulingRuleError("却下理由を入力してください。");
      }
    }

    let adminEmail: string | null = null;
    try {
      const adminRecord = await firebaseAuth.getUser(adminUid);
      adminEmail = adminRecord.email ?? null;
    } catch (error) {
      console.warn("Failed to retrieve admin user for audit log", error);
    }

    await reviewScheduledSpot(
      req.params.id,
      {
        status: payload.status,
        reviewNotes: payload.reviewNotes,
        promotion: payload.promotion
          ? {
            ...payload.promotion,
            expiresAt: payload.promotion.expiresAt ? new Date(payload.promotion.expiresAt) : undefined
          }
          : null,
        templateId: payload.templateId
      },
      {
        uid: adminUid,
        email: adminEmail ?? undefined
      }
    );
    res.status(204).end();
  } catch (error) {
    if (error instanceof SchedulingRuleError) {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};

export const enforceRealtimeSpotWindow = async (uid: string, startTime: Date) => {
  const poster = await getPosterProfile(uid);
  if (!poster.phoneVerified) {
    throw new PhoneVerificationRequiredError("スポットを投稿するにはSMS本人認証が必要です。");
  }
  assertRealtimePostWindow(poster.tier, startTime);
};

export const toApiSpot = (spot: ScheduledSpot) => ({
  ...spot,
  startTime: spot.startTime.toISOString(),
  endTime: spot.endTime.toISOString(),
  publishAt: spot.publishAt.toISOString(),
  createdAt: spot.createdAt.toISOString()
});
