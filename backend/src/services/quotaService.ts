import { FieldPath } from "firebase-admin/firestore";

import { getTierConfig } from "../constants/billing.js";

import { firestore } from "./firebaseAdmin.js";
import type { PosterTier, PromotionQuota } from "./posterProfileService.js";

const USERS_COLLECTION = "users";
const BATCH_LIMIT = 300;

type UserDocument = {
  poster_tier?: PosterTier;
  promotion_quota?: PromotionQuota;
  promotion_quota_updated_at?: string;
};

export type QuotaResetResult = {
  uid: string;
  tier: PosterTier;
  previousQuota: PromotionQuota | null;
  nextQuota: PromotionQuota;
};

type ResetOptions = {
  dryRun?: boolean;
  logger?: (result: QuotaResetResult) => void;
};

export const resetPromotionQuotas = async (now: Date = new Date(), options: ResetOptions = {}) => {
  const { dryRun = false, logger } = options;
  const issuedAt = now.toISOString();
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot<UserDocument> | null = null;
  const results: QuotaResetResult[] = [];

  for (;;) {
    let query = firestore
      .collection(USERS_COLLECTION)
      .orderBy(FieldPath.documentId())
      .limit(BATCH_LIMIT) as FirebaseFirestore.Query<UserDocument>;

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      break;
    }

    const batch = dryRun ? null : firestore.batch();

    snapshot.docs.forEach((doc) => {
      const data = doc.data() ?? {};
      const tier = (data.poster_tier ?? "tier_c") as PosterTier;
      const nextQuota = getTierConfig(tier).quota;
      const record: QuotaResetResult = {
        uid: doc.id,
        tier,
        previousQuota: data.promotion_quota ?? null,
        nextQuota
      };

      results.push(record);
      logger?.(record);

      if (!dryRun && batch) {
        const payload: FirebaseFirestore.UpdateData<UserDocument> = {
          promotion_quota: nextQuota,
          promotion_quota_updated_at: issuedAt
        };
        batch.set(doc.ref, payload, { merge: true });
      }
    });

    if (!dryRun && batch) {
      await batch.commit();
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  return results;
};
