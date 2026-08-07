const Stripe = require('stripe');

let stripe;

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }
  if (!stripe) {
    // API versiyasini pin qilamiz. Busiz Stripe hisobdagi versiya o'zgarganda
    // javob shakli jimgina o'zgarib, webhook'lar buzilishi mumkin.
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: process.env.STRIPE_API_VERSION || '2025-10-29.clover',
    });
  }
  return stripe;
};

/**
 * `current_period_end` Stripe'ning yangi API versiyalarida subscription obyektidan
 * subscription item'ga ko'chdi. Ikkalasini ham tekshiramiz — aks holda maydon
 * `undefined` bo'lib qoladi va `getEffectivePlan()` muddat tekshiruvini o'tkazib
 * yuboradi, ya'ni bekor qilingan obuna abadiy "active" bo'lib qoladi.
 */
const readPeriodEnd = (subscription) => {
  const raw =
    subscription?.items?.data?.[0]?.current_period_end ??
    subscription?.current_period_end ??
    null;
  return raw ? new Date(raw * 1000) : null;
};

const PRICE_MAP = {
  pro: process.env.STRIPE_PRICE_PRO,
  premium: process.env.STRIPE_PRICE_PREMIUM,
};

const createCheckoutSession = async ({ user, plan, successUrl, cancelUrl }) => {
  const client = getStripe();
  if (!client) {
    throw new Error('Stripe is not configured');
  }
  const priceId = PRICE_MAP[plan];
  if (!priceId) {
    throw new Error(`No Stripe price configured for plan: ${plan}`);
  }

  let customerId = user.subscription?.stripeCustomerId;
  if (!customerId) {
    const customer = await client.customers.create({
      email: user.email,
      name: user.name,
      metadata: { userId: String(user._id) },
    });
    customerId = customer.id;
    user.subscription = user.subscription || {};
    user.subscription.stripeCustomerId = customerId;
    await user.save();
  }

  const session = await client.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId: String(user._id), plan },
    // MUHIM: checkout session metadata'si subscription obyektiga AVTOMATIK o'tmaydi.
    // Busiz `customer.subscription.updated` webhook'ida userId topilmay,
    // handler jimgina return qilardi — ya'ni obuna hech qachon yangilanmasdi.
    subscription_data: {
      metadata: { userId: String(user._id), plan },
    },
  });

  return session;
};

const createPortalSession = async (user, returnUrl) => {
  const client = getStripe();
  if (!client || !user.subscription?.stripeCustomerId) {
    throw new Error('Stripe customer not found');
  }
  return client.billingPortal.sessions.create({
    customer: user.subscription.stripeCustomerId,
    return_url: returnUrl,
  });
};

const constructWebhookEvent = (rawBody, signature) => {
  const client = getStripe();
  if (!client || !process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error('Stripe webhook not configured');
  }
  return client.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
};

module.exports = {
  getStripe,
  readPeriodEnd,
  createCheckoutSession,
  createPortalSession,
  constructWebhookEvent,
};
