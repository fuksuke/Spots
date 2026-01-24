import crypto from "node:crypto";

import type { Request, Response, NextFunction } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

import { SPOT_CATEGORY_VALUES } from "../constants/categories.js";
import { firebaseAuth, firestore } from "../services/firebaseAdmin.js";
import type { SpotResponse } from "../services/firestoreService.js";
import { fetchSpotsByIds } from "../services/firestoreService.js";
import { sanitizeStringArray, sanitizeUserIds } from "../utils/sanitize.js";
import { COLLECTIONS } from "../constants/collections.js";

type UserDocData = {
  email?: string | null;
  display_name?: string | null;
  photo_url?: string | null;
  followed_user_ids?: string[];
  favorite_spot_ids?: string[];
  followed_categories?: string[];
  created_at?: Timestamp;
  poster_tier?: "tier_a" | "tier_b" | "tier_c";
  followers_count?: number;
  engagement_score?: number;
  promotion_quota?: {
    short_term?: number;
    long_term?: number;
  };
  promotion_quota_updated_at?: Timestamp | string;
  flags?: {
    is_verified?: boolean;
    is_sponsor?: boolean;
  };
  stripe_customer_id?: string | null;
  phone_verified?: boolean;
  phone_verified_at?: Timestamp | string;
  phone_hash?: string | null;
};

type ProfileResponse = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
  followedUserIds: string[];
  followedUsers: Array<{ uid: string; displayName: string | null; photoUrl: string | null }>;
  followedCategories: string[];
  favoriteSpotIds: string[];
  favoriteSpots: SpotResponse[];
  createdAt: string | null;
  posterTier: "tier_a" | "tier_b" | "tier_c";
  followersCount: number;
  engagementScore: number;
  promotionQuota: {
    shortTerm?: number;
    longTerm?: number;
  };
  promotionQuotaUpdatedAt: string | null;
  isVerified: boolean;
  isSponsor: boolean;
  stripeCustomerId: string | null;
  phoneVerified: boolean;
  phoneVerifiedAt: string | null;
};

const ensureUserDocument = async (uid: string): Promise<{ data: UserDocData; ref: FirebaseFirestore.DocumentReference<UserDocData> }> => {
  const userRef = firestore.collection(COLLECTIONS.USERS).doc(uid) as FirebaseFirestore.DocumentReference<UserDocData>;
  let snapshot = await userRef.get();

  if (!snapshot.exists) {
    const authRecord = await firebaseAuth.getUser(uid);
    const initialData: UserDocData = {
      email: authRecord.email ?? null,
      display_name: authRecord.displayName ?? null,
      photo_url: authRecord.photoURL ?? null,
      followed_user_ids: [],
      favorite_spot_ids: [],
      followed_categories: [],
      created_at: Timestamp.now()
    };
    await userRef.set(initialData);
    snapshot = await userRef.get();
  }

  let data = (snapshot.data() as UserDocData) ?? {};

  if (!data.display_name || !data.photo_url) {
    try {
      const authRecord = await firebaseAuth.getUser(uid);
      const updatePayload: Partial<UserDocData> = {};
      if (!data.display_name && authRecord.displayName) {
        updatePayload.display_name = authRecord.displayName;
      }
      if (!data.photo_url && authRecord.photoURL) {
        updatePayload.photo_url = authRecord.photoURL;
      }
      if (Object.keys(updatePayload).length > 0) {
        await userRef.set(updatePayload, { merge: true });
        data = { ...data, ...updatePayload };
      }
    } catch {
      /* ignore auth fetch failures */
    }
  }

  return { data, ref: userRef };
};

const buildProfileResponse = async (uid: string): Promise<ProfileResponse> => {
  const { data } = await ensureUserDocument(uid);

  const followedUserIds = sanitizeUserIds(data.followed_user_ids);
  const favoriteSpotIds = sanitizeStringArray(data.favorite_spot_ids);
  const followedCategories = sanitizeStringArray(data.followed_categories);
  const promotionQuota = data.promotion_quota ?? {};

  const followedUserDocs = followedUserIds.length > 0 ? await firestore.getAll(...followedUserIds.map((id) => firestore.collection(COLLECTIONS.USERS).doc(id))) : [];
  const followedUserDocMap = new Map<string, FirebaseFirestore.DocumentSnapshot<UserDocData>>();
  followedUserDocs.forEach((doc, idx) => {
    const id = followedUserIds[idx];
    if (id) {
      followedUserDocMap.set(id, doc as FirebaseFirestore.DocumentSnapshot<UserDocData>);
    }
  });

  const followedUsers = await Promise.all(
    followedUserIds.map(async (id) => {
      const doc = followedUserDocMap.get(id);
      if (doc && doc.exists) {
        const docData = doc.data() as UserDocData;
        return {
          uid: id,
          displayName: typeof docData.display_name === "string" ? docData.display_name : null,
          photoUrl: typeof docData.photo_url === "string" ? docData.photo_url : null
        };
      }
      try {
        const record = await firebaseAuth.getUser(id);
        return { uid: id, displayName: record.displayName ?? null, photoUrl: record.photoURL ?? null };
      } catch {
        return { uid: id, displayName: null, photoUrl: null };
      }
    })
  );

  const favoriteSpots = await fetchSpotsByIds(favoriteSpotIds.slice(0, 50), uid);

  return {
    uid,
    email: typeof data.email === "string" ? data.email : null,
    displayName: typeof data.display_name === "string" ? data.display_name : null,
    photoUrl: typeof data.photo_url === "string" ? data.photo_url : null,
    followedUserIds,
    followedUsers,
    followedCategories,
    favoriteSpotIds,
    favoriteSpots,
    createdAt:
      data.created_at && typeof data.created_at.toDate === "function"
        ? data.created_at.toDate().toISOString()
        : null,
    posterTier: data.poster_tier ?? "tier_c",
    followersCount: typeof data.followers_count === "number" ? data.followers_count : 0,
    engagementScore: typeof data.engagement_score === "number" ? data.engagement_score : 0,
    promotionQuota: {
      shortTerm: promotionQuota?.short_term,
      longTerm: promotionQuota?.long_term
    },
    promotionQuotaUpdatedAt:
      typeof data.promotion_quota_updated_at === "string"
        ? data.promotion_quota_updated_at
        : data.promotion_quota_updated_at && typeof data.promotion_quota_updated_at.toDate === "function"
        ? data.promotion_quota_updated_at.toDate().toISOString()
        : null,
    isVerified: Boolean(data.flags?.is_verified),
    isSponsor: Boolean(data.flags?.is_sponsor),
    stripeCustomerId:
      typeof data.stripe_customer_id === "string" && data.stripe_customer_id.trim().length > 0
        ? data.stripe_customer_id.trim()
        : null,
    phoneVerified: Boolean(data.phone_verified),
    phoneVerifiedAt:
      typeof data.phone_verified_at === "string"
        ? data.phone_verified_at
        : data.phone_verified_at && typeof (data.phone_verified_at as Timestamp).toDate === "function"
        ? (data.phone_verified_at as Timestamp).toDate().toISOString()
        : null
  } satisfies ProfileResponse;
};

const phoneVerificationSchema = z.object({
  phoneNumber: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{6,14}$/, "電話番号はE.164形式(+81...)で送信してください。")
});

const resolvePhoneHashSecret = () => {
  const secret = process.env.PHONE_HASH_SECRET ?? process.env.SMS_PHONE_HASH_SECRET;
  if (!secret) {
    throw new Error("PHONE_HASH_SECRET is not configured");
  }
  return secret;
};

export const getProfileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as Request & { uid?: string }).uid;
    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const profile = await buildProfileResponse(uid);
    res.json(profile);
  } catch (error) {
    next(error);
  }
};

export const verifyPhoneHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as Request & { uid?: string }).uid;
    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { phoneNumber } = phoneVerificationSchema.parse(req.body ?? {});
    const normalized = phoneNumber.trim();
    const secret = resolvePhoneHashSecret();
    const phoneHash = crypto.createHmac("sha256", secret).update(normalized).digest("hex");

    const existing = await firestore
      .collection("users")
      .where("phone_hash", "==", phoneHash)
      .limit(1)
      .get();

    if (!existing.empty && existing.docs[0]?.id !== uid) {
      return res.status(409).json({ message: "この電話番号は既に使用されています。", code: "PHONE_NUMBER_IN_USE" });
    }

    const now = Timestamp.now();
    await firestore.collection(COLLECTIONS.USERS).doc(uid).set(
      {
        phone_verified: true,
        phone_verified_at: now,
        phone_hash: phoneHash
      },
      { merge: true }
    );

    const profile = await buildProfileResponse(uid);
    res.json(profile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors?.[0]?.message ?? "電話番号が不正です" });
    }
    if (error instanceof Error && error.message === "PHONE_HASH_SECRET is not configured") {
      return res.status(500).json({ message: "SMS認証の設定が不足しています" });
    }
    next(error);
  }
};

const updateProfileSchema = z.object({
  displayName: z
    .union([z.string().max(80), z.null()])
    .optional()
    .transform((value) => (typeof value === "string" ? value.trim() : value)),
  photoUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  followedCategories: z.array(z.enum(SPOT_CATEGORY_VALUES)).optional()
});

export const updateProfileHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as Request & { uid?: string }).uid;
    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { displayName, photoUrl, followedCategories } = updateProfileSchema.parse(req.body ?? {});

    const updates: Partial<UserDocData> = {};

    if (displayName !== undefined) {
      const trimmed = displayName && displayName.length > 0 ? displayName : null;
      updates.display_name = trimmed;
      await firebaseAuth.updateUser(uid, { displayName: trimmed ?? undefined });
    }

    if (photoUrl !== undefined) {
      const normalizedPhotoUrl = photoUrl === "" ? null : photoUrl;
      updates.photo_url = normalizedPhotoUrl ?? null;
      await firebaseAuth.updateUser(uid, { photoURL: normalizedPhotoUrl ?? null });
    }

    if (followedCategories !== undefined) {
      updates.followed_categories = followedCategories;
    }

    if (Object.keys(updates).length > 0) {
      await firestore.collection(COLLECTIONS.USERS).doc(uid).set(updates, { merge: true });
    }

    const profile = await buildProfileResponse(uid);
    res.json(profile);
  } catch (error) {
    next(error);
  }
};
