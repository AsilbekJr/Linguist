const express = require('express');
const User = require('../models/User');
const BillingEvent = require('../models/BillingEvent');
const { constructWebhookEvent, readPeriodEnd, getStripe } = require('../services/stripeService');

const router = express.Router();

const VALID_PLANS = new Set(['pro', 'premium']);
const normalizePlan = (plan) => (VALID_PLANS.has(plan) ? plan : 'pro');

/** Stripe status → bizdagi status */
const mapStatus = (stripeStatus) => {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
    case 'past_due':
    case 'canceled':
      return stripeStatus;
    case 'incomplete':
    case 'incomplete_expired':
    case 'unpaid':
      return 'past_due';
    default:
      return 'canceled';
  }
};

/**
 * Obunani foydalanuvchiga yozish.
 *
 * userId'ni uch joydan qidiramiz: subscription metadata → customer metadata →
 * DB'dagi stripeCustomerId. Ilgari faqat birinchisi tekshirilardi va u ko'pincha
 * bo'sh bo'lgani uchun handler jimgina chiqib ketardi.
 */
const findUserForSubscription = async (subscription) => {
  const metaUserId = subscription.metadata?.userId;
  if (metaUserId) {
    const user = await User.findById(metaUserId).catch(() => null);
    if (user) return user;
  }

  if (subscription.customer) {
    const byCustomer = await User.findOne({
      'subscription.stripeCustomerId': subscription.customer,
    });
    if (byCustomer) return byCustomer;

    // Oxirgi chora — Stripe'dan customer metadata'sini so'raymiz
    try {
      const client = getStripe();
      const customer = client && (await client.customers.retrieve(subscription.customer));
      const customerUserId = customer?.metadata?.userId;
      if (customerUserId) {
        const user = await User.findById(customerUserId).catch(() => null);
        if (user) return user;
      }
    } catch (err) {
      console.warn('Stripe customer lookup failed:', err.message);
    }
  }

  return User.findOne({ 'subscription.stripeSubscriptionId': subscription.id });
};

const applySubscription = async (subscription) => {
  const user = await findUserForSubscription(subscription);
  if (!user) {
    console.warn('Webhook: subscription uchun foydalanuvchi topilmadi', subscription.id);
    return;
  }

  const status = mapStatus(subscription.status);
  const isLive = status === 'active' || status === 'trialing';
  const plan = normalizePlan(subscription.metadata?.plan || user.subscription?.plan);

  user.subscription = {
    ...(user.subscription?.toObject?.() || user.subscription || {}),
    plan: isLive ? plan : 'free',
    status,
    provider: 'stripe',
    stripeCustomerId: subscription.customer || user.subscription?.stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: readPeriodEnd(subscription),
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
  };
  await user.save();
};

router.post('/', async (req, res) => {
  const signature = req.headers['stripe-signature'];
  let event;

  try {
    event = constructWebhookEvent(req.body, signature);
  } catch (error) {
    // Imzo yaroqsiz — 400 qaytaramiz, Stripe qayta urinmaydi
    console.error('Stripe webhook signature error:', error.message);
    return res.status(400).json({ message: 'Invalid signature' });
  }

  try {
    // Idempotentlik: bir hodisa ikki marta qayta ishlanmasin
    const existing = await BillingEvent.findOne({ eventId: event.id });
    if (existing) {
      return res.json({ received: true, duplicate: true });
    }
    await BillingEvent.create({
      provider: 'stripe',
      eventId: event.id,
      type: event.type,
      payload: event.data.object,
    });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        if (!userId) break;

        const user = await User.findById(userId).catch(() => null);
        if (!user) break;

        user.subscription = {
          ...(user.subscription?.toObject?.() || user.subscription || {}),
          plan: normalizePlan(session.metadata?.plan),
          status: 'active',
          provider: 'stripe',
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription || user.subscription?.stripeSubscriptionId,
        };
        await user.save();

        // To'liq muddat ma'lumotini subscription obyektidan olamiz
        if (session.subscription) {
          try {
            const client = getStripe();
            const sub = await client.subscriptions.retrieve(session.subscription);
            await applySubscription(sub);
          } catch (err) {
            console.warn('Subscription retrieve failed:', err.message);
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'invoice.payment_succeeded':
      case 'customer.subscription.deleted': {
        const object = event.data.object;
        // invoice hodisasida subscription id ichkarida
        if (event.type === 'invoice.payment_succeeded') {
          const subId = object.subscription || object.parent?.subscription_details?.subscription;
          if (!subId) break;
          const client = getStripe();
          const sub = await client.subscriptions.retrieve(subId);
          await applySubscription(sub);
        } else {
          await applySubscription(object);
        }
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook handling error:', error);
    // 500 → Stripe qayta yuboradi (BillingEvent yozilgani uchun dublikat xavfsiz)
    res.status(500).json({ message: 'Webhook processing error' });
  }
});

module.exports = router;
