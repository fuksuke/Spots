import Stripe from "stripe";
import * as functions from "firebase-functions";
import { FieldValue } from "firebase-admin/firestore";
import { firestore, getTierConfig, captureSentryException } from "@shibuya/backend";
const ENV_VAR_MAP = {
    api_key: "STRIPE_API_KEY",
    webhook_secret: "STRIPE_WEBHOOK_SECRET",
    price_tier_a: "STRIPE_PRICE_TIER_A",
    price_tier_b: "STRIPE_PRICE_TIER_B"
};
const STRIPE_WEBHOOK_EVENTS_COLLECTION = "stripe_webhook_events";
const NOTIFICATIONS_COLLECTION = "notifications";
const PLAN_LABEL = {
    tier_a: "スポンサー (Tier A)",
    tier_b: "クリエイタープラン (Tier B)",
    tier_c: "フリープラン"
};
const parseEnvList = (value) => value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean) ?? [];
const getBillingAlertRecipients = () => {
    const envCandidates = [
        ...parseEnvList(process.env.BILLING_ALERT_RECIPIENT_UIDS),
        ...parseEnvList(process.env.BILLING_ALERT_RECIPIENT_UID)
    ];
    const configList = (() => {
        const alertsConfig = functions.config()?.alerts;
        const value = alertsConfig?.billing_recipient_uids;
        if (typeof value === "string") {
            return parseEnvList(value);
        }
        return [];
    })();
    return Array.from(new Set([...envCandidates, ...configList]));
};
const addBillingNotification = async ({ userId, title, body, priority, metadata }) => {
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
    }
    catch (error) {
        functions.logger.error("Failed to create billing notification", { userId, error: error.message });
        captureSentryException(error, { userId, scope: "billing-notification" });
    }
};
const broadcastBillingAlert = async (title, body, metadata) => {
    const recipients = getBillingAlertRecipients();
    await Promise.all(recipients.map((recipient) => addBillingNotification({
        userId: recipient,
        title,
        body,
        metadata,
        priority: "high"
    })));
};
const getStripeConfigValue = (key) => {
    const envVarKey = ENV_VAR_MAP[key];
    const envValue = process.env[envVarKey];
    if (envValue && envValue.trim()) {
        return envValue.trim();
    }
    const configStripe = functions.config()?.stripe;
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
const resolvePlanFromMetadata = (metadata) => {
    const rawPlan = metadata?.plan ?? metadata?.Plan ?? metadata?.PLAN;
    if (typeof rawPlan === "string" && (rawPlan === "tier_a" || rawPlan === "tier_b")) {
        return rawPlan;
    }
    return null;
};
const resolvePlanFromPrice = (priceId) => {
    if (!priceId)
        return null;
    if (priceId === getStripeConfigValue("price_tier_a")) {
        return "tier_a";
    }
    if (priceId === getStripeConfigValue("price_tier_b")) {
        return "tier_b";
    }
    return null;
};
const resolvePlan = (options) => {
    const planFromMetadata = resolvePlanFromMetadata(options.metadata);
    if (planFromMetadata) {
        return planFromMetadata;
    }
    return resolvePlanFromPrice(options.priceId ?? null);
};
const resolveUidFromMetadata = (metadata) => {
    const rawUid = metadata?.firebaseUid ?? metadata?.firebase_uid ?? metadata?.uid;
    if (typeof rawUid === "string" && rawUid.trim()) {
        return rawUid.trim();
    }
    return null;
};
const reserveStripeEvent = async (event, nowIso) => {
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
            return { shouldProcess: true, data: null };
        }
        const data = current.data();
        if (data?.status === "processed") {
            return { shouldProcess: false, data };
        }
        tx.update(docRef, {
            status: "processing",
            attempts: FieldValue.increment(1),
            lastAttemptAt: nowIso
        });
        return { shouldProcess: true, data };
    });
    return { docRef, shouldProcess: snapshot.shouldProcess };
};
const finalizeStripeEvent = async (docRef, status, nowIso, extra) => {
    await docRef.set({
        status,
        processedAt: nowIso,
        lastAttemptAt: nowIso,
        ...(extra ?? {})
    }, { merge: true });
};
export const withStripeEventIdempotency = async (event, handler) => {
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await finalizeStripeEvent(docRef, "failed", new Date().toISOString(), {
            lastError: message.slice(0, 1000)
        });
        captureSentryException(error, { eventId: event.id, eventType: event.type });
        throw error;
    }
};
const updateUserTier = async (uid, tierConfig, customerId) => {
    const payload = {
        promotion_quota_updated_at: new Date().toISOString()
    };
    if (tierConfig) {
        payload.poster_tier = tierConfig.posterTier;
        payload.promotion_quota = tierConfig.quota;
    }
    else {
        payload.poster_tier = "tier_c";
        payload.promotion_quota = {};
    }
    if (customerId) {
        payload.stripe_customer_id = customerId;
    }
    await firestore.collection("users").doc(uid).set(payload, { merge: true });
    functions.logger.info("Updated poster tier", { uid, tier: payload.poster_tier });
};
export const handleSubscriptionUpsert = async (eventObject) => {
    const metadata = eventObject.metadata ?? eventObject.metadata;
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
            const session = eventObject;
            const priceFromSubscription = session.subscription?.items?.data?.[0]?.price?.id;
            const displayItems = session.display_items;
            return priceFromSubscription ?? displayItems?.[0]?.price?.id ?? null;
        })()
    });
    if (!plan) {
        const stripeObjectId = eventObject.id ?? null;
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
        await broadcastBillingAlert("Stripeイベントのプラン解析に失敗", "決済イベントからプランを判別できません。ダッシュボードとStripe管理画面を確認してください。", {
            uid,
            stripeObjectId
        });
        return;
    }
    const customerId = (() => {
        const raw = eventObject.customer ?? eventObject.customer;
        if (!raw)
            return null;
        if (typeof raw === "string")
            return raw;
        if (typeof raw === "object" && "id" in raw && typeof raw.id === "string") {
            return raw.id;
        }
        return null;
    })();
    const tierConfig = getTierConfig(plan);
    await updateUserTier(uid, {
        posterTier: plan,
        quota: tierConfig.quota
    }, customerId);
    const stripeObjectId = eventObject.id ?? null;
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
export const handleSubscriptionCancel = async (subscription) => {
    const uid = resolveUidFromMetadata(subscription.metadata);
    if (!uid) {
        functions.logger.warn("Subscription cancel event missing firebaseUid metadata");
        return;
    }
    const customerId = (() => {
        const raw = subscription.customer;
        if (!raw)
            return null;
        if (typeof raw === "string")
            return raw;
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
export const constructStripeEvent = (rawBody, signature) => {
    const webhookSecret = getStripeConfigValue("webhook_secret");
    const stripe = getStripeInstance();
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
};
