import * as functions from "firebase-functions";
import Stripe from "stripe";
import {
  createApp,
  rebuildPopularSpotsLeaderboard,
  publishDueScheduledSpots,
  expirePromotions,
  archivePastSpots,
  cleanupExpiredImages,
  resetPromotionQuotas,
  captureSentryException
} from "@shibuya/backend";
import {
  constructStripeEvent,
  handleSubscriptionUpsert,
  handleSubscriptionCancel,
  withStripeEventIdempotency
} from "./stripeHandlers.js";

const app = createApp();

export const api = functions.region("asia-northeast1").https.onRequest(app);

export const stripeWebhook = functions.region("asia-northeast1").https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.set("Allow", "POST");
    res.status(405).send("Method Not Allowed");
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (!signature || Array.isArray(signature)) {
    res.status(400).send("Missing Stripe signature header");
    return;
  }

  try {
    const event = constructStripeEvent(req.rawBody, signature);

    const outcome = await withStripeEventIdempotency(event, async () => {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          await handleSubscriptionUpsert(session);
          break;
        }
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionUpsert(subscription);
          break;
        }
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionCancel(subscription);
          break;
        }
        default:
          functions.logger.debug("Unhandled Stripe event", { type: event.type });
      }
    });

    res.status(200).send({ received: true, duplicate: outcome.status === "duplicate" });
  } catch (error) {
    functions.logger.error("Stripe webhook error", error);
    captureSentryException(error, { function: "stripeWebhook" });
    res.status(400).send("Invalid request");
  }
});

export const refreshPopularSpots = functions
  .region("asia-northeast1")
  .pubsub.schedule("every 15 minutes")
  .timeZone("Asia/Tokyo")
  .onRun(async () => {
    try {
      await rebuildPopularSpotsLeaderboard();
    } catch (error) {
      captureSentryException(error, { function: "refreshPopularSpots" });
      throw error;
    }
  });

export const processScheduledSpots = functions
  .region("asia-northeast1")
  .pubsub.schedule("every 5 minutes")
  .timeZone("Asia/Tokyo")
  .onRun(async () => {
    try {
      await publishDueScheduledSpots();
    } catch (error) {
      captureSentryException(error, { function: "processScheduledSpots" });
      throw error;
    }
  });

export const tidyPromotions = functions
  .region("asia-northeast1")
  .pubsub.schedule("every 24 hours")
  .timeZone("Asia/Tokyo")
  .onRun(async () => {
    try {
      await expirePromotions();
    } catch (error) {
      captureSentryException(error, { function: "tidyPromotions" });
      throw error;
    }
  });

export const archiveSpotsJob = functions
  .region("asia-northeast1")
  .pubsub.schedule("every 15 minutes")
  .timeZone("Asia/Tokyo")
  .onRun(async () => {
    try {
      await archivePastSpots();
    } catch (error) {
      captureSentryException(error, { function: "archiveSpotsJob" });
      throw error;
    }
  });

export const cleanupImagesJob = functions
  .region("asia-northeast1")
  .pubsub.schedule("every 24 hours")
  .timeZone("Asia/Tokyo")
  .onRun(async () => {
    try {
      await cleanupExpiredImages();
    } catch (error) {
      captureSentryException(error, { function: "cleanupImagesJob" });
      throw error;
    }
  });

export const resetPosterQuotas = functions
  .region("asia-northeast1")
  .pubsub.schedule("0 3 1 * *")
  .timeZone("Asia/Tokyo")
  .onRun(async () => {
    try {
      await resetPromotionQuotas();
    } catch (error) {
      captureSentryException(error, { function: "resetPosterQuotas" });
      throw error;
    }
  });
