import Stripe from "stripe";
import * as functions from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import type { DocumentReference } from "firebase-admin/firestore";
import { firestore, getTierConfig, captureSentryException } from "@shibuya/backend";
import type { PosterTier, PromotionQuota } from "@shibuya/backend";

type StripeConfigKey = "api_key" | "webhook_secret" | "price_tier_a" | "price_tier_b";

const ENV_VAR_MAP: Record<StripeConfigKey, string> = {
  api_key: "STRIPE_API_KEY",
  webhook_secret: "STRIPE_WEBHOOK_SECRET",
  price_tier_a: "STRIPE_PRICE_TIER_A",
  price_tier_b: "STRIPE_PRICE_TIER_B"
};

const STRIPE_WEBHOOK_EVENTS_COLLECTION = "stripe_webhook_events";
const NOTIFICATIONS_COLLECTION = "notifications";

type NotificationPriority = "standard" | "high";

const PLAN_LABEL: Record<Exclude<PosterTier, "tier_c"> | "tier_c", string> = {
  tier_a: "スポンサー (Tier A)",
  tier_b: "クリエイタープラン (Tier B)",
  tier_c: "フリープラン"
};

const parseEnvList = (value: string | undefined | null) =>
  value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

const getBillingAlertRecipients = () => {
  const envCandidates = [
    ...parseEnvList(process.env.BILLING_ALERT_RECIPIENT_UIDS),
    ...parseEnvList(process.env.BILLING_ALERT_RECIPIENT_UID)
  ];

  const configList = (() => {
    const alertsConfig = functions.config()?.alerts as Record<string, unknown> | undefined;
    const value = alertsConfig?.billing_recipient_uids;
    if (typeof value === "string") {
      return parseEnvList(value);
    }
    return [] as string[];
  })();

  return Array.from(new Set([...envCandidates, ...configList]));
};

const addBillingNotification = async ({
  userId,
  title,
  body,
  priority,
  metadata
}: {
  userId: string;
  title: string;
  body: string;
  priority: NotificationPriority;
  metadata?: Record<string, unknown>;
}) => {
  try {
    await firestore.collection(NOTIFICATIONS_COLLECTION).add({
      user_id: userId,
      title,
      body,
      category: "billing",
      metadata: metadata ?? {},
      priority,
      read: false,
      created_at: FieldValue.serverTimestamp()
    });
  } catch (error) {
    functions.logger.error("Failed to create billing notification", { userId, error: (error as Error).message });
    captureSentryException(error, { userId, scope: "billing-notification" });
  }
};

const broadcastBillingAlert = async (
  title: string,
  body: string,
  metadata?: Record<string, unknown>
) => {
  const recipients = getBillingAlertRecipients();
  await Promise.all(
    recipients.map((recipient) =>
      addBillingNotification({
        userId: recipient,
        title,
        body,
        metadata,
        priority: "high"
      })
    )
  );
};


const getStripeConfigValue = (key: StripeConfigKey): string => {
  const envVarKey = ENV_VAR_MAP[key];
  const envValue = process.env[envVarKey];
  if (envValue && envValue.trim()) {
    return envValue.trim();
  }

  const configStripe = functions.config()?.stripe as Record<string, string> | undefined;
  const configValue = configStripe?.[key];
  if (configValue && configValue.trim()) {
    return configValue.trim();
  }

  throw new Error(`Missing Stripe configuration for ${envVarKey} or functions.config().stripe.${key}`);
};

export const getStripeInstance = () => {
  const apiKey = getStripeConfigValue("api_key");
  return new Stripe(apiKey, {
    apiVersion: "2025-08-27.basil"
  });
};

const resolvePlanFromMetadata = (metadata: Stripe.Metadata | Stripe.MetadataParam | null | undefined) => {
  const rawPlan = metadata?.plan ?? metadata?.Plan ?? metadata?.PLAN;
  if (typeof rawPlan === "string" && (rawPlan === "tier_a" || rawPlan === "tier_b")) {
    return rawPlan;
  }
  return null;
};

const resolvePlanFromPrice = (priceId: string | null | undefined) => {
  if (!priceId) return null;
  if (priceId === getStripeConfigValue("price_tier_a")) {
    return "tier_a" as const;
  }
  if (priceId === getStripeConfigValue("price_tier_b")) {
    return "tier_b" as const;
  }
  return null;
};

const resolvePlan = (options: {
  metadata?: Stripe.Metadata | Stripe.MetadataParam | null;
  priceId?: string | null;
}) => {
  const planFromMetadata = resolvePlanFromMetadata(options.metadata);
  if (planFromMetadata) {
    return planFromMetadata;
  }
  return resolvePlanFromPrice(options.priceId ?? null);
};

const resolveUidFromMetadata = (metadata: Stripe.Metadata | Stripe.MetadataParam | null | undefined) => {
  const rawUid = metadata?.firebaseUid ?? metadata?.firebase_uid ?? metadata?.uid;
  if (typeof rawUid === "string" && rawUid.trim()) {
    return rawUid.trim();
  }
  return null;
};

type IdempotencyStatus = "processed" | "duplicate";

const reserveStripeEvent = async (event: Stripe.Event, nowIso: string) => {
  const docRef = firestore.collection(STRIPE_WEBHOOK_EVENTS_COLLECTION).doc(event.id);
  const snapshot = await firestore.runTransaction(async (tx) => {
    const current = await tx.get(docRef);
    if (!current.exists) {
      tx.set(docRef, {
        type: event.type,
        status: "processing",
        attempts: 1,
        createdAt: nowIso,
        lastAttemptAt: nowIso
      });
      return { shouldProcess: true, data: null } as const;
    }

    const data = current.data() as { status?: string } | undefined;
    if (data?.status === "processed") {
      return { shouldProcess: false, data } as const;
    }

    tx.update(docRef, {
      status: "processing",
      attempts: FieldValue.increment(1),
      lastAttemptAt: nowIso
    });
    return { shouldProcess: true, data } as const;
  });

  return { docRef, shouldProcess: snapshot.shouldProcess };
};

const finalizeStripeEvent = async (
  docRef: DocumentReference,
  status: "processed" | "failed",
  nowIso: string,
  extra?: Record<string, unknown>
) => {
  await docRef.set(
    {
      status,
      processedAt: nowIso,
      lastAttemptAt: nowIso,
      ...(extra ?? {})
    },
    { merge: true }
  );
};

export const withStripeEventIdempotency = async <T>(
  event: Stripe.Event,
  handler: () => Promise<T>
): Promise<{ status: IdempotencyStatus; result?: T }> => {
  const nowIso = new Date().toISOString();
  const { docRef, shouldProcess } = await reserveStripeEvent(event, nowIso);

  if (!shouldProcess) {
    functions.logger.debug("Skipping duplicate Stripe event", { eventId: event.id, type: event.type });
    return { status: "duplicate" };
  }

  try {
    const result = await handler();
    await finalizeStripeEvent(docRef, "processed", new Date().toISOString());
    return { status: "processed", result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finalizeStripeEvent(docRef, "failed", new Date().toISOString(), {
      lastError: message.slice(0, 1000)
    });
    captureSentryException(error, { eventId: event.id, eventType: event.type });
    throw error;
  }
};

const updateUserTier = async (
  uid: string,
  tierConfig: { posterTier: PosterTier; quota: PromotionQuota } | null,
  customerId: string | null
) => {
  const payload: Record<string, unknown> = {
    promotion_quota_updated_at: new Date().toISOString()
  };

  if (tierConfig) {
    payload.poster_tier = tierConfig.posterTier;
    payload.promotion_quota = tierConfig.quota;
  } else {
    payload.poster_tier = "tier_c";
    payload.promotion_quota = {};
  }

  if (customerId) {
    payload.stripe_customer_id = customerId;
  }

  await firestore.collection("users").doc(uid).set(payload, { merge: true });
  functions.logger.info("Updated poster tier", { uid, tier: payload.poster_tier });
};

export const handleSubscriptionUpsert = async (
  eventObject: Stripe.Subscription | Stripe.Checkout.Session
) => {
  const metadata = (eventObject as Stripe.Subscription).metadata ?? (
    eventObject as Stripe.Checkout.Session
  ).metadata;

  const uid = resolveUidFromMetadata(metadata);
  if (!uid) {
    functions.logger.warn("Stripe event missing firebaseUid metadata");
    return;
  }

  const plan = resolvePlan({
    metadata,
    priceId: (() => {
      if ("items" in eventObject && eventObject.items?.data?.length) {
        return eventObject.items.data[0]?.price?.id ?? null;
      }
      const session = eventObject as Stripe.Checkout.Session;
      const priceFromSubscription =
        (session.subscription as Stripe.Subscription | null | undefined)?.items?.data?.[0]?.price?.id;
      const displayItems = (session as Stripe.Checkout.Session & {
        display_items?: Array<{ price?: Stripe.Price | null }>;
      }).display_items;
      return priceFromSubscription ?? displayItems?.[0]?.price?.id ?? null;
    })()
  });

  if (!plan) {
    const stripeObjectId = (eventObject as { id?: string }).id ?? null;
    functions.logger.warn("Could not resolve plan from Stripe event", {
      uid,
      stripeObjectId,
      hasItems: "items" in eventObject ? eventObject.items?.data?.length ?? 0 : "session"
    });

    await addBillingNotification({
      userId: uid,
      title: "課金情報の更新に失敗しました",
      body: "Stripeから取得したプラン情報を特定できませんでした。お手数ですがサポートまでお問い合わせください。",
      priority: "high",
      metadata: {
        eventType: "subscription_upsert_error",
        stripeObjectId
      }
    });

    await broadcastBillingAlert(
      "Stripeイベントのプラン解析に失敗",
      "決済イベントからプランを判別できません。ダッシュボードとStripe管理画面を確認してください。",
      {
        uid,
        stripeObjectId
      }
    );

    return;
  }

  const customerId = (() => {
    const raw = (eventObject as Stripe.Subscription).customer ?? (eventObject as Stripe.Checkout.Session).customer;
    if (!raw) return null;
    if (typeof raw === "string") return raw;
    if (typeof raw === "object" && "id" in raw && typeof raw.id === "string") {
      return raw.id;
    }
    return null;
  })();

  const tierConfig = getTierConfig(plan);

  await updateUserTier(
    uid,
    {
      posterTier: plan,
      quota: tierConfig.quota
    },
    customerId
  );

  const stripeObjectId = (eventObject as { id?: string }).id ?? null;
  await addBillingNotification({
    userId: uid,
    title: `${PLAN_LABEL[plan]} が有効になりました`,
    body: `${PLAN_LABEL[plan]}へのアップグレードが完了しました。Billing FAQに記載の特典をご利用いただけます。`,
    priority: "standard",
    metadata: {
      plan,
      eventType: "subscription_upsert",
      stripeObjectId
    }
  });
};

export const handleSubscriptionCancel = async (subscription: Stripe.Subscription) => {
  const uid = resolveUidFromMetadata(subscription.metadata);
  if (!uid) {
    functions.logger.warn("Subscription cancel event missing firebaseUid metadata");
    return;
  }

  const customerId = (() => {
    const raw = subscription.customer;
    if (!raw) return null;
    if (typeof raw === "string") return raw;
    if (typeof raw === "object" && "id" in raw && typeof raw.id === "string") {
      return raw.id;
    }
    return null;
  })();

  await updateUserTier(uid, null, customerId);

  await addBillingNotification({
    userId: uid,
    title: "サブスクリプションが解約されました",
    body: "Stripe上でプランが解約され、フリープランに戻りました。再開する場合はアップグレードから手続きを行ってください。",
    priority: "standard",
    metadata: {
      plan: "tier_c",
      eventType: "subscription_cancel",
      stripeObjectId: subscription.id,
      customerId
    }
  });
};

export const constructStripeEvent = (rawBody: Buffer, signature: string) => {
  const webhookSecret = getStripeConfigValue("webhook_secret");
  const stripe = getStripeInstance();
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
};
