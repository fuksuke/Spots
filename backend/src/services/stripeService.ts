import Stripe from "stripe";

type StripeRequestOptions = Stripe.RequestOptions;

let stripeClient: Stripe | null = null;

const assertStripeSecret = () => {
  const secretKey = process.env.STRIPE_API_KEY;
  if (!secretKey) {
    throw new Error("Stripe secret key is not configured (STRIPE_API_KEY)");
  }
  return secretKey;
};

export const getStripeClient = () => {
  if (!stripeClient) {
    const secretKey = assertStripeSecret();
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2025-08-27.basil"
    });
  }
  return stripeClient;
};

type CheckoutParams = {
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string | null;
  priceId: string;
  uid: string;
  plan: "tier_b" | "tier_a";
  customerId?: string | null;
  idempotencyKey?: string | null;
};

export const createCheckoutSession = async ({
  successUrl,
  cancelUrl,
  customerEmail,
  priceId,
  uid,
  plan,
  customerId,
  idempotencyKey
}: CheckoutParams) => {
  const stripe = getStripeClient();
  const requestOptions: StripeRequestOptions = {};
  if (idempotencyKey) {
    requestOptions.idempotencyKey = idempotencyKey;
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      customer_email: customerEmail ?? undefined,
      customer: customerId ?? undefined,
      client_reference_id: uid,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        firebaseUid: uid,
        plan
      },
      subscription_data: {
        metadata: {
          firebaseUid: uid,
          plan
        }
      }
    },
    requestOptions
  );

  return session;
};

type PortalSessionParams = {
  customerId: string;
  returnUrl: string;
};

export const createBillingPortalSession = async ({ customerId, returnUrl }: PortalSessionParams) => {
  const stripe = getStripeClient();
  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl
  });
};
