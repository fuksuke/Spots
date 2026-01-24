import crypto from "node:crypto";

import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

import { firebaseAuth, firestore } from "../services/firebaseAdmin.js";
import { createBillingPortalSession, createCheckoutSession } from "../services/stripeService.js";
import { COLLECTIONS } from "../constants/collections.js";

const checkoutRequestSchema = z.object({
  plan: z.enum(["tier_b", "tier_a"]),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional()
});

const portalRequestSchema = z.object({
  returnUrl: z.string().url().optional()
});

class ConfigurationError extends Error {}

const resolvePriceId = (plan: "tier_b" | "tier_a") => {
  const envKey = plan === "tier_a" ? "STRIPE_PRICE_TIER_A" : "STRIPE_PRICE_TIER_B";
  const priceId = process.env[envKey];
  if (!priceId) {
    throw new ConfigurationError(`${envKey} is not configured`);
  }
  return priceId;
};

const resolveReturnUrl = (explicit: string | undefined, fallbackEnvKey: string) => {
  if (explicit) return explicit;
  const fallback = process.env[fallbackEnvKey];
  if (!fallback) {
    throw new ConfigurationError(`${fallbackEnvKey} is not configured`);
  }
  return fallback;
};

const buildCheckoutIdempotencyKey = (uid: string, plan: "tier_a" | "tier_b") => {
  const epochHour = Math.floor(Date.now() / (60 * 60 * 1000));
  return crypto.createHash("sha256").update(`${uid}:${plan}:${epochHour}`).digest("hex");
};

export const createCheckoutSessionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as Request & { uid?: string }).uid;
    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { plan, successUrl, cancelUrl } = checkoutRequestSchema.parse(req.body ?? {});

    let customerEmail: string | null = null;
    try {
      const record = await firebaseAuth.getUser(uid);
      customerEmail = record.email ?? null;
    } catch (error) {
      console.warn(`Failed to retrieve Firebase user for checkout session: ${uid}`, error);
    }

    const userSnapshot = await firestore.collection(COLLECTIONS.USERS).doc(uid).get();
    const userData = (userSnapshot.data() as { stripe_customer_id?: string | null }) ?? {};
    const stripeCustomerId = typeof userData.stripe_customer_id === "string" ? userData.stripe_customer_id.trim() : null;

    const session = await createCheckoutSession({
      successUrl: resolveReturnUrl(successUrl, "STRIPE_SUCCESS_URL"),
      cancelUrl: resolveReturnUrl(cancelUrl, "STRIPE_CANCEL_URL"),
      customerEmail,
      priceId: resolvePriceId(plan),
      uid,
      plan,
      customerId: stripeCustomerId,
      idempotencyKey: buildCheckoutIdempotencyKey(uid, plan)
    });

    res.json({ id: session.id, url: session.url });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(error.message);
      return res.status(500).json({ message: "Stripe configuration error" });
    }
    next(error);
  }
};

export const createPortalSessionHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as Request & { uid?: string }).uid;
    if (!uid) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const { returnUrl } = portalRequestSchema.parse(req.body ?? {});

    const userSnapshot = await firestore.collection(COLLECTIONS.USERS).doc(uid).get();
    const userData = (userSnapshot.data() as { stripe_customer_id?: string | null }) ?? {};
    const stripeCustomerId = typeof userData.stripe_customer_id === "string" ? userData.stripe_customer_id.trim() : null;

    if (!stripeCustomerId) {
      return res.status(400).json({ message: "Stripe customer is not linked to this account" });
    }

    const session = await createBillingPortalSession({
      customerId: stripeCustomerId,
      returnUrl: resolveReturnUrl(returnUrl, "STRIPE_PORTAL_RETURN_URL")
    });

    res.json({ url: session.url });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(error.message);
      return res.status(500).json({ message: "Stripe configuration error" });
    }
    next(error);
  }
};
