import { Timestamp } from "firebase-admin/firestore";

import { firestore } from "./firebaseAdmin.js";

export type PosterTier = "tier_a" | "tier_b" | "tier_c";

export type PromotionQuota = {
  short_term?: number;
  long_term?: number;
};

export type PosterProfile = {
  uid: string;
  tier: PosterTier;
  followersCount: number;
  engagementScore: number;
  promotionQuota: PromotionQuota;
  promotionQuotaUpdatedAt: string | null;
  isVerified: boolean;
  isSponsor: boolean;
  stripeCustomerId: string | null;
};

const DEFAULT_PROFILE: PosterProfile = {
  uid: "",
  tier: "tier_c",
  followersCount: 0,
  engagementScore: 0,
  promotionQuota: {},
  promotionQuotaUpdatedAt: null,
  isVerified: false,
  isSponsor: false,
  stripeCustomerId: null
};

type UserDocument = {
  poster_tier?: PosterTier;
  followers_count?: number;
  engagement_score?: number;
  promotion_quota?: PromotionQuota;
  promotion_quota_updated_at?: string | Timestamp;
  flags?: {
    is_verified?: boolean;
    is_sponsor?: boolean;
  };
  stripe_customer_id?: string | null;
};

export const getPosterProfile = async (uid: string): Promise<PosterProfile> => {
  const snapshot = await firestore.collection("users").doc(uid).get();
  const data = (snapshot.data() as UserDocument) ?? {};

  return {
    ...DEFAULT_PROFILE,
    uid,
    tier: data.poster_tier ?? DEFAULT_PROFILE.tier,
    followersCount: data.followers_count ?? DEFAULT_PROFILE.followersCount,
    engagementScore: data.engagement_score ?? DEFAULT_PROFILE.engagementScore,
    promotionQuota: data.promotion_quota ?? DEFAULT_PROFILE.promotionQuota,
    promotionQuotaUpdatedAt:
      typeof data.promotion_quota_updated_at === "string"
        ? data.promotion_quota_updated_at
        : data.promotion_quota_updated_at && data.promotion_quota_updated_at instanceof Timestamp
        ? data.promotion_quota_updated_at.toDate().toISOString()
        : DEFAULT_PROFILE.promotionQuotaUpdatedAt,
    isVerified: Boolean(data.flags?.is_verified),
    isSponsor: Boolean(data.flags?.is_sponsor),
    stripeCustomerId: typeof data.stripe_customer_id === "string" && data.stripe_customer_id.trim()
      ? data.stripe_customer_id.trim()
      : null
  } satisfies PosterProfile;
};

type SpotTiming = {
  publishAt: Date;
  startTime: Date;
  tier: PosterTier;
  announcementType: "short_term_notice" | "long_term_campaign";
};

const HOURS = 60 * 60 * 1000;
const DAYS = 24 * HOURS;

export class SchedulingRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchedulingRuleError";
  }
}

export const assertSchedulingWindow = ({ publishAt, startTime, tier, announcementType }: SpotTiming) => {
  const now = Date.now();
  const publishOffset = publishAt.getTime() - now;
  const startOffset = startTime.getTime() - now;

  if (publishOffset < HOURS) {
    throw new SchedulingRuleError("公開時刻は現在時刻の1時間以上先に設定してください。");
  }

  if (announcementType === "short_term_notice") {
    const maxWindow = tier === "tier_c" ? 6 * HOURS : 48 * HOURS;
    if (publishOffset > maxWindow) {
      throw new SchedulingRuleError(
        tier === "tier_c"
          ? "一般ユーザーは6時間より先の告知は予約できません。"
          : "短期告知の予約は48時間以内に制限されています。"
      );
    }
    if (startOffset > 72 * HOURS) {
      throw new SchedulingRuleError("イベント開始時刻が遠すぎます。72時間以内に設定してください。");
    }
  } else if (announcementType === "long_term_campaign") {
    if (tier !== "tier_a") {
      throw new SchedulingRuleError("長期告知は公式パートナーのみ利用できます。");
    }
    if (publishOffset < 3 * DAYS) {
      throw new SchedulingRuleError("長期告知は3日以上先に公開する必要があります。");
    }
    if (publishOffset > 90 * DAYS) {
      throw new SchedulingRuleError("長期告知の公開は90日以内に制限されています。");
    }
  }
};

type QuotaCheckParams = {
  uid: string;
  announcementType: "short_term_notice" | "long_term_campaign";
  publishAt: Date;
  quota: PromotionQuota;
};

const windowStartForQuota = (publishAt: Date, days: number) =>
  Timestamp.fromMillis(publishAt.getTime() - days * DAYS);

export const assertQuotaAvailability = async ({
  uid,
  announcementType,
  publishAt,
  quota
}: QuotaCheckParams) => {
  if (announcementType === "short_term_notice" && typeof quota.short_term === "number") {
    const since = windowStartForQuota(publishAt, 7);
    const snapshot = await firestore
      .collection("scheduled_spots")
      .where("owner_id", "==", uid)
      .where("announcement_type", "==", "short_term_notice")
      .where("publish_at", ">=", since)
      .get();
    if (snapshot.size >= quota.short_term) {
      throw new SchedulingRuleError("短期告知の上限に達しています。しばらくしてから再度お試しください。");
    }
  }
  if (announcementType === "long_term_campaign" && typeof quota.long_term === "number") {
    const since = windowStartForQuota(publishAt, 30);
    const snapshot = await firestore
      .collection("scheduled_spots")
      .where("owner_id", "==", uid)
      .where("announcement_type", "==", "long_term_campaign")
      .where("publish_at", ">=", since)
      .get();
    if (snapshot.size >= quota.long_term) {
      throw new SchedulingRuleError("長期告知の掲載上限に達しています。プランをアップグレードするか期間を調整してください。");
    }
  }
};

export const assertRealtimePostWindow = (tier: PosterTier, startTime: Date) => {
  const now = Date.now();
  const startOffset = startTime.getTime() - now;
  if (startOffset > 6 * HOURS && tier === "tier_c") {
    throw new SchedulingRuleError("一般ユーザーの投稿は6時間以内のイベントに限定されます。予約投稿をご利用ください。");
  }
  if (startOffset > 48 * HOURS && tier === "tier_b") {
    throw new SchedulingRuleError("短期告知は予約投稿をご利用ください。開始まで48時間以内のイベントのみ直接投稿できます。");
  }
  if (startOffset > 90 * DAYS) {
    throw new SchedulingRuleError("開始時刻が遠すぎます。90日以内に設定してください。");
  }
};
