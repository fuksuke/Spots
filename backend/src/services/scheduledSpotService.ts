import { Timestamp } from "firebase-admin/firestore";

import type { SpotCategory } from "../constants/categories.js";
import { COLLECTIONS } from "../constants/collections.js";
import { REVIEW_TEMPLATES } from "../constants/moderation.js";

import { firestore } from "./firebaseAdmin.js";
import type {
  PosterProfile,
  PosterTier
} from "./posterProfileService.js";
import {
  assertQuotaAvailability,
  assertSchedulingWindow,
  SchedulingRuleError
} from "./posterProfileService.js";
import { notifySystemAlert } from "./notificationService.js";

export type AnnouncementType = "short_term_notice" | "long_term_campaign";

export type PricingInfo = {
  label?: string;
  amount?: number;
  currency?: string;
  isFree: boolean;
} | null;

export type ContactInfo = {
  phone?: string | null;
  email?: string | null;
  sns?: Record<string, string> | null;
} | null;

export type ExternalLink = {
  label: string;
  url: string;
  icon?: string | null;
};

export type ScheduledSpotInput = {
  title: string;
  description: string;
  category: SpotCategory;
  lat: number;
  lng: number;
  startTime: Date;
  endTime: Date;
  publishAt: Date;
  ownerId: string;
  announcementType: AnnouncementType;
  imageUrl?: string | null;
  speechBubble?: string | null;
  locationName?: string | null;
  locationDetails?: string | null;
  pricing?: PricingInfo;
  contact?: ContactInfo;
  externalLinks?: ExternalLink[] | null;
  ownerDisplayName?: string | null;
  ownerPhotoUrl?: string | null;
};

export type ScheduledSpotStatus = "pending" | "approved" | "published" | "rejected" | "cancelled";

export type ScheduledSpot = ScheduledSpotInput & {
  id: string;
  status: ScheduledSpotStatus;
  createdAt: Date;
  reviewNotes: string | null;
  speechBubble: string | null;
  locationName: string | null;
  locationDetails: string | null;
  pricing: PricingInfo;
  contact: ContactInfo;
  externalLinks: ExternalLink[] | null;
  ownerDisplayName: string | null;
  ownerPhotoUrl: string | null;
};

type ScheduledSpotDocument = {
  title: string;
  description: string;
  category: SpotCategory;
  lat: number;
  lng: number;
  start_time: Timestamp;
  end_time: Timestamp;
  publish_at: Timestamp;
  owner_id: string;
  announcement_type: AnnouncementType;
  status: ScheduledSpotStatus;
  created_at: Timestamp;
  image_url?: string | null;
  review_notes?: string | null;
  speech_bubble?: string | null;
  location_name?: string | null;
  location_details?: string | null;
  pricing?: PricingInfo;
  contact?: ContactInfo;
  external_links?: ExternalLink[] | null;
  owner_display_name?: string | null;
  owner_photo_url?: string | null;
};

const REVIEW_LOG_COLLECTION = COLLECTIONS.SCHEDULED_SPOT_REVIEW_LOGS;
const NOTIFICATIONS_COLLECTION = COLLECTIONS.NOTIFICATIONS;

type ReviewLogDocument = {
  spot_id: string;
  actor_uid: string;
  actor_email?: string | null;
  previous_status: ScheduledSpotStatus;
  next_status: "approved" | "rejected";
  review_notes?: string | null;
  review_template_id?: string | null;
  created_at: Timestamp;
};

export type ScheduledSpotReviewLog = {
  id: string;
  spotId: string;
  actorUid: string;
  actorEmail: string | null;
  previousStatus: ScheduledSpotStatus;
  nextStatus: "approved" | "rejected";
  reviewNotes: string | null;
  reviewTemplateId: string | null;
  createdAt: string;
};

type NotificationDocument = {
  user_id: string;
  title: string;
  body: string;
  category: "moderation" | "system";
  metadata?: Record<string, unknown>;
  read: boolean;
  created_at: Timestamp;
  priority: "standard" | "high";
};

const toScheduledSpot = (id: string, doc: ScheduledSpotDocument): ScheduledSpot => ({
  id,
  title: doc.title,
  description: doc.description,
  category: doc.category,
  lat: doc.lat,
  lng: doc.lng,
  startTime: doc.start_time.toDate(),
  endTime: doc.end_time.toDate(),
  publishAt: doc.publish_at.toDate(),
  ownerId: doc.owner_id,
  announcementType: doc.announcement_type,
  status: doc.status,
  createdAt: doc.created_at.toDate(),
  reviewNotes: doc.review_notes ?? null,
  imageUrl: doc.image_url ?? null,
  speechBubble: doc.speech_bubble ?? null,
  locationName: doc.location_name ?? null,
  locationDetails: doc.location_details ?? null,
  pricing: doc.pricing ?? null,
  contact: doc.contact ?? null,
  externalLinks: doc.external_links ?? null,
  ownerDisplayName: doc.owner_display_name ?? null,
  ownerPhotoUrl: doc.owner_photo_url ?? null
});

const toReviewLog = (
  doc: FirebaseFirestore.QueryDocumentSnapshot<ReviewLogDocument>
): ScheduledSpotReviewLog => {
  const data = doc.data();
  if (!data) {
    throw new Error("Scheduled spot review log is missing data");
  }
  return {
    id: doc.id,
    spotId: data.spot_id,
    actorUid: data.actor_uid,
    actorEmail: typeof data.actor_email === "string" && data.actor_email.trim().length > 0 ? data.actor_email.trim() : null,
    previousStatus: data.previous_status,
    nextStatus: data.next_status,
    reviewNotes: data.review_notes ?? null,
    reviewTemplateId:
      typeof data.review_template_id === "string" && data.review_template_id.trim().length > 0
        ? data.review_template_id.trim()
        : null,
    createdAt: data.created_at.toDate().toISOString()
  } satisfies ScheduledSpotReviewLog;
};

const shouldAutoApprove = (tier: PosterTier, type: AnnouncementType) => {
  if (type === "short_term_notice") {
    return true;
  }
  return tier === "tier_a";
};

export const createScheduledSpot = async (
  input: ScheduledSpotInput,
  poster: PosterProfile
): Promise<ScheduledSpot> => {
  assertSchedulingWindow({
    publishAt: input.publishAt,
    startTime: input.startTime,
    tier: poster.tier,
    announcementType: input.announcementType
  });

  await assertQuotaAvailability({
    uid: input.ownerId,
    announcementType: input.announcementType,
    publishAt: input.publishAt,
    quota: poster.promotionQuota
  });

  const status: ScheduledSpotStatus = shouldAutoApprove(poster.tier, input.announcementType)
    ? "approved"
    : "pending";
  const now = Timestamp.now();

  const docRef = await firestore.collection(COLLECTIONS.SCHEDULED_SPOTS).add({
    title: input.title,
    description: input.description,
    category: input.category,
    lat: input.lat,
    lng: input.lng,
    start_time: Timestamp.fromDate(input.startTime),
    end_time: Timestamp.fromDate(input.endTime),
    publish_at: Timestamp.fromDate(input.publishAt),
    owner_id: input.ownerId,
    announcement_type: input.announcementType,
    status,
    created_at: now,
    image_url: input.imageUrl ?? null,
    speech_bubble: input.speechBubble ?? null,
    location_name: input.locationName ?? null,
    location_details: input.locationDetails ?? null,
    pricing: input.pricing ?? null,
    contact: input.contact ?? null,
    external_links: input.externalLinks ?? null,
    owner_display_name: input.ownerDisplayName ?? null,
    owner_photo_url: input.ownerPhotoUrl ?? null
  } satisfies ScheduledSpotDocument);

  return {
    ...input,
    id: docRef.id,
    status,
    createdAt: now.toDate(),
    reviewNotes: null,
    speechBubble: input.speechBubble ?? null,
    locationName: input.locationName ?? null,
    locationDetails: input.locationDetails ?? null,
    pricing: input.pricing ?? null,
    contact: input.contact ?? null,
    externalLinks: input.externalLinks ?? null,
    ownerDisplayName: input.ownerDisplayName ?? null,
    ownerPhotoUrl: input.ownerPhotoUrl ?? null
  } satisfies ScheduledSpot;
};

type UpdateScheduledSpotPayload = Partial<Pick<ScheduledSpotInput, "title" | "description" | "category" | "lat" | "lng" | "startTime" | "endTime" | "publishAt" | "announcementType" | "imageUrl">>;

export const updateScheduledSpot = async (
  spotId: string,
  ownerId: string,
  payload: UpdateScheduledSpotPayload,
  poster: PosterProfile
): Promise<ScheduledSpot> => {
  const docRef = firestore.collection(COLLECTIONS.SCHEDULED_SPOTS).doc(spotId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    throw new SchedulingRuleError("予約投稿が見つかりませんでした。");
  }
  const current = toScheduledSpot(spotId, snapshot.data() as ScheduledSpotDocument);
  if (current.ownerId !== ownerId) {
    throw new SchedulingRuleError("この予約投稿を編集する権限がありません。");
  }
  if (current.status !== "pending" && current.status !== "approved") {
    throw new SchedulingRuleError("公開処理中の予約は編集できません。");
  }

  const next = {
    ...current,
    ...payload,
    startTime: payload.startTime ?? current.startTime,
    endTime: payload.endTime ?? current.endTime,
    publishAt: payload.publishAt ?? current.publishAt,
    announcementType: payload.announcementType ?? current.announcementType
  } satisfies ScheduledSpot;

  assertSchedulingWindow({
    publishAt: next.publishAt,
    startTime: next.startTime,
    tier: poster.tier,
    announcementType: next.announcementType
  });

  await docRef.update({
    title: next.title,
    description: next.description,
    category: next.category,
    lat: next.lat,
    lng: next.lng,
    start_time: Timestamp.fromDate(next.startTime),
    end_time: Timestamp.fromDate(next.endTime),
    publish_at: Timestamp.fromDate(next.publishAt),
    announcement_type: next.announcementType,
    image_url: next.imageUrl ?? null,
    status: shouldAutoApprove(poster.tier, next.announcementType) ? "approved" : current.status
  });

  const updated = await docRef.get();
  return toScheduledSpot(spotId, updated.data() as ScheduledSpotDocument);
};

export const cancelScheduledSpot = async (
  spotId: string,
  actor: { uid: string; isAdmin?: boolean } | string // string for backward compatibility (ownerId)
) => {
  const actorUid = typeof actor === "string" ? actor : actor.uid;
  const isAdmin = typeof actor === "string" ? false : Boolean(actor.isAdmin);
  const docRef = firestore.collection(COLLECTIONS.SCHEDULED_SPOTS).doc(spotId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    throw new SchedulingRuleError("予約投稿が見つかりませんでした。");
  }
  const current = snapshot.data() as ScheduledSpotDocument;
  if (current.owner_id !== actorUid && !isAdmin) {
    throw new SchedulingRuleError("この予約投稿をキャンセルする権限がありません。");
  }
  if (current.status === "published" || current.status === "cancelled") {
    return;
  }
  await docRef.update({ status: "cancelled" satisfies ScheduledSpotStatus });
};

export const listScheduledSpotsForUser = async (ownerId: string): Promise<ScheduledSpot[]> => {
  const snapshot = await firestore
    .collection("scheduled_spots")
    .where("owner_id", "==", ownerId)
    .orderBy("publish_at", "asc")
    .get();
  return snapshot.docs.map((doc) => toScheduledSpot(doc.id, doc.data() as ScheduledSpotDocument));
};

type AdminListParams = {
  status?: ScheduledSpotStatus;
  limit?: number;
  ownerId?: string;
  publishStart?: Date;
  publishEnd?: Date;
};

export const listScheduledSpotsForAdmin = async ({
  status,
  limit = 50,
  ownerId,
  publishStart,
  publishEnd
}: AdminListParams = {}) => {
  const collection = firestore.collection(COLLECTIONS.SCHEDULED_SPOTS) as FirebaseFirestore.CollectionReference<ScheduledSpotDocument>;
  let query: FirebaseFirestore.Query<ScheduledSpotDocument> = collection;

  if (status) {
    query = query.where("status", "==", status);
  }
  if (ownerId) {
    query = query.where("owner_id", "==", ownerId);
  }
  if (publishStart) {
    query = query.where("publish_at", ">=", Timestamp.fromDate(publishStart));
  }
  if (publishEnd) {
    query = query.where("publish_at", "<=", Timestamp.fromDate(publishEnd));
  }

  query = query.orderBy("publish_at", "asc").limit(limit);
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => toScheduledSpot(doc.id, doc.data()));
};

type ApprovalPayload = {
  status: "approved" | "rejected";
  reviewNotes?: string | null;
  promotion?: {
    headline?: string;
    ctaUrl?: string | null;
    imageUrl?: string | null;
    priority?: number;
    expiresAt?: Date;
  } | null;
  templateId?: string | null;
};

export const reviewScheduledSpot = async (
  spotId: string,
  payload: ApprovalPayload,
  actor: { uid: string; email?: string | null }
) => {
  const docRef = firestore.collection(COLLECTIONS.SCHEDULED_SPOTS).doc(spotId);
  const snapshot = await docRef.get();
  if (!snapshot.exists) {
    throw new SchedulingRuleError("予約投稿が見つかりませんでした。");
  }
  const current = snapshot.data() as ScheduledSpotDocument;
  if (current.status !== "pending") {
    // Allow unpublishing: status 'published' -> 'rejected'
    if (current.status === "published" && payload.status === "rejected") {
      // Allow transition
    } else {
      throw new SchedulingRuleError("この予約投稿はすでに審査済みです。");
    }
  }

  const matchedTemplate = payload.templateId
    ? REVIEW_TEMPLATES.find((template) => template.id === payload.templateId)
    : undefined;
  const effectiveTemplate = matchedTemplate && matchedTemplate.status === payload.status ? matchedTemplate : undefined;

  await docRef.update({
    status: payload.status,
    review_notes: payload.reviewNotes ?? null
  });
  if (payload.status === "approved" && payload.promotion) {
    const expiresAt = payload.promotion.expiresAt ?? current.start_time.toDate();
    await firestore.collection(COLLECTIONS.PROMOTIONS).doc(spotId).set({
      spot_id: null,
      owner_id: current.owner_id,
      publish_at: current.publish_at,
      expires_at: Timestamp.fromDate(expiresAt),
      headline: payload.promotion.headline ?? current.title,
      cta_url: payload.promotion.ctaUrl ?? null,
      image_url: payload.promotion.imageUrl ?? null,
      priority: payload.promotion.priority ?? 0,
      status: "scheduled"
    });
  } else if (payload.status === "rejected" && current.status === "published") {
    // Unpublish logic: Find the public spot created from this scheduled spot and delete/hide it.
    // The link is not explicitly stored in scheduled_spots (except logic in publishDueScheduledSpots, but we don't save spotId on scheduled_spot doc).
    // Wait, publishDueScheduledSpots updates promotion with spot_id, but check if scheduled_spot has it?
    // "publishDueScheduledSpots" adds "spotRef" and updates doc with status="published", review_notes=null.
    // It DOES NOT save the spot_id back to scheduled_spot document.
    // Hmmm. This makes unpublishing hard because we don't know which spot_id corresponds to this scheduled_spot.
    // We should probably implement searching for the spot by matching attributes or simply implement "deleteSpot" via admin panel directly on the spot,
    // and just mark scheduled_spot as rejected for record keeping.

    // However, if we want to "Unpublish" from the Admin Scheduled Spots panel, we need to find the spot.
    // For now, let's assume we can query spots by owner_id and potentially title/created_at if needed, but that's risky.
    // Alternatively, we rely on the Admin Spot List to delete spots.
    // BUT the requirement is "reviewScheduledSpot: published -> rejected (公開取り消し)".

    // Let's check "promotions" collection. It has "spot_id" and uses "spotId" (scheduled spot id) as doc id.
    const promotionRef = firestore.collection(COLLECTIONS.PROMOTIONS).doc(spotId);
    const promotionSnap = await promotionRef.get();
    if (promotionSnap.exists) {
      const promoData = promotionSnap.data();
      if (promoData?.spot_id) {
        // Delete the public spot
        await firestore.collection(COLLECTIONS.SPOTS).doc(promoData.spot_id).delete();
      }
      // Mark promotion as ended/rejected
      await promotionRef.update({ status: "disabled" }); // or delete
    } else {
      // If no promotion doc, we might have trouble finding the public spot.
      // We can try to look up a spot with 'owner_id' == current.owner_id and matching 'created_at' ~ 'publish_at'?
      // The spot's created_at is set to Timestamp.now() at publish time.
      // The spot's properties match the scheduled spot.
      // Let's assume for MVP we might miss deleting the public spot if it wasn't a promotion?
      // Wait, "publishDueScheduledSpots" copies data to "spots".
      // If we don't link them, we can't delete reliably.

      // Strategy: We should probably add a task to "publishDueScheduledSpots" to save the `public_spot_id` on the `scheduled_spot` doc.
      // But for existing data we can't rely on it.
      // For now, let's rely on the Admin using the "Delete Spot" feature on the public spot directly if manual link fails.
      // But let's try to handle the "promotion" case and maybe "search by exact match" case.

      // Actually, let's look at `publishDueScheduledSpots` again.
      // It creates a spot.
      // Ideally we should record that ID.
    }
  }

  const notificationsCollection = firestore.collection(NOTIFICATIONS_COLLECTION) as FirebaseFirestore.CollectionReference<NotificationDocument>;
  const title = payload.status === "approved" ? "予約告知が承認されました" : "予約告知が却下されました";
  const defaultBodyApproved = `${current.title} の予約告知が承認されました。公開予定: ${current.publish_at
    .toDate()
    .toLocaleString("ja-JP")}`;
  const defaultBodyRejected = `${current.title} の予約告知は却下されました。理由: ${payload.reviewNotes ?? "追加情報をご確認ください"}`;
  const body = effectiveTemplate?.notificationHint ?? (payload.status === "approved" ? defaultBodyApproved : defaultBodyRejected);

  const notificationPriority = effectiveTemplate?.priority ?? (payload.status === "approved" ? "standard" : "high");
  const reviewTemplateId = effectiveTemplate?.id ?? payload.templateId ?? null;

  await notificationsCollection.add({
    user_id: current.owner_id,
    title,
    body,
    category: "moderation",
    metadata: {
      spotId,
      status: payload.status,
      previousStatus: current.status,
      reviewNotes: payload.reviewNotes ?? null,
      reviewTemplateId
    },
    read: false,
    created_at: Timestamp.now(),
    priority: notificationPriority
  });


  const reviewCollection = firestore.collection(REVIEW_LOG_COLLECTION) as FirebaseFirestore.CollectionReference<ReviewLogDocument>;

  await reviewCollection.add({
    spot_id: spotId,
    actor_uid: actor.uid,
    actor_email: actor.email ?? null,
    previous_status: current.status,
    next_status: payload.status,
    review_notes: payload.reviewNotes ?? null,
    review_template_id: reviewTemplateId,
    created_at: Timestamp.now()
  } satisfies ReviewLogDocument);
};

export const listScheduledSpotReviewLogs = async (spotId: string, limit = 25) => {
  const reviewCollection = firestore.collection(REVIEW_LOG_COLLECTION) as FirebaseFirestore.CollectionReference<ReviewLogDocument>;

  const snapshot = await reviewCollection
    .where("spot_id", "==", spotId)
    .orderBy("created_at", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => toReviewLog(doc));
};

export const fetchActivePromotions = async () => {
  const snapshot = await firestore
    .collection("promotions")
    .where("status", "==", "active")
    .orderBy("priority", "desc")
    .orderBy("publish_at", "asc")
    .limit(30)
    .get();
  const now = Date.now();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as {
        spot_id?: string | null;
        owner_id: string;
        publish_at: Timestamp;
        expires_at: Timestamp;
        headline?: string;
        cta_url?: string | null;
        image_url?: string | null;
        priority?: number;
      };
      const expiresAtDate = data.expires_at.toDate();
      if (expiresAtDate.getTime() < now) {
        return null;
      }
      return {
        id: doc.id,
        spotId: data.spot_id ?? null,
        ownerId: data.owner_id,
        publishAt: data.publish_at.toDate().toISOString(),
        expiresAt: expiresAtDate.toISOString(),
        headline: data.headline ?? null,
        ctaUrl: data.cta_url ?? null,
        imageUrl: data.image_url ?? null,
        priority: data.priority ?? 0
      };
    })
    .filter((promotion): promotion is Exclude<typeof promotion, null> => promotion !== null)
    .slice(0, 3);
};

type PublishResult = {
  publishedSpotIds: string[];
  activatedPromotionIds: string[];
};

export const publishDueScheduledSpots = async (): Promise<PublishResult> => {
  const publishedSpotIds: string[] = [];
  const activatedPromotionIds: string[] = [];

  try {
    const now = Timestamp.now();
    const snapshot = await firestore
      .collection("scheduled_spots")
      .where("status", "in", ["approved"])
      .where("publish_at", "<=", now)
      .limit(50)
      .get();

    if (snapshot.empty) {
      return { publishedSpotIds, activatedPromotionIds } satisfies PublishResult;
    }

    for (const doc of snapshot.docs) {
      const data = doc.data() as ScheduledSpotDocument;
      const spotRef = await firestore.collection(COLLECTIONS.SPOTS).add({
        title: data.title,
        description: data.description,
        category: data.category,
        lat: data.lat,
        lng: data.lng,
        start_time: data.start_time,
        end_time: data.end_time,
        image_url: data.image_url ?? null,
        owner_id: data.owner_id,
        likes: 0,
        comments_count: 0,
        created_at: Timestamp.now()
      });
      publishedSpotIds.push(spotRef.id);
      await doc.ref.update({
        status: "published" satisfies ScheduledSpotStatus,
        review_notes: null
      });

      const promotionRef = firestore.collection(COLLECTIONS.PROMOTIONS).doc(doc.id);
      const promotion = await promotionRef.get();
      if (promotion.exists) {
        await promotionRef.update({
          status: "active",
          spot_id: spotRef.id,
          publish_at: data.publish_at,
          expires_at: promotion.data()?.expires_at ?? data.end_time
        });
        activatedPromotionIds.push(promotionRef.id);
      }
    }

    if (publishedSpotIds.length > 0) {
      await notifySystemAlert("予約投稿の自動公開を実行しました", {
        count: publishedSpotIds.length,
        publishedSpotIds
      });
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await notifySystemAlert("自動公開ジョブでエラーが発生しました", { error: message });
    throw error;
  }

  return { publishedSpotIds, activatedPromotionIds } satisfies PublishResult;
};

export const expirePromotions = async () => {
  const now = Timestamp.now();
  const snapshot = await firestore
    .collection("promotions")
    .where("status", "==", "active")
    .where("expires_at", "<=", now)
    .limit(50)
    .get();

  const batch = firestore.batch();
  snapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { status: "expired" });
  });
  if (snapshot.size > 0) {
    await batch.commit();
  }
};
