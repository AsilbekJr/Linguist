const express = require('express');
const User = require('../models/User');
const BillingEvent = require('../models/BillingEvent');
const { constructWebhookEvent } = require('../services/stripeService');

const router = express.Router();

const handleStripeSubscriptionUpdate = async (subscription) => {
  const userId = subscription.metadata?.userId;
  if (!userId) return;

  const user = await User.findById(userId);
  if (!user) return;

  const plan = subscription.metadata?.plan || 'pro';
  user.subscription = {
    ...user.subscription,
    plan: ['pro', 'premium'].includes(plan) ? plan : 'pro',
    status: subscription.status === 'active' ? 'active' : subscription.status,
    provider: 'stripe',
    stripeCustomerId: subscription.customer,
    stripeSubscriptionId: subscription.id,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
  };
  await user.save();
};

router.post('/', async (req, res) => {
  const signature = req.headers['stripe-signature'];
  try {
    const event = constructWebhookEvent(req.body, signature);

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

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.metadata?.userId) {
        const user = await User.findById(session.metadata.userId);
        if (user) {
          user.subscription = user.subscription || {};
          user.subscription.plan = session.metadata.plan || 'pro';
          user.subscription.status = 'active';
          user.subscription.provider = 'stripe';
          user.subscription.stripeCustomerId = session.customer;
          if (session.subscription) {
            user.subscription.stripeSubscriptionId = session.subscription;
          }
          await user.save();
        }
      }
    }

    if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.created'
    ) {
      await handleStripeSubscriptionUpdate(event.data.object);
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const user = await User.findOne({
        'subscription.stripeSubscriptionId': sub.id,
      });
      if (user) {
        user.subscription.plan = 'free';
        user.subscription.status = 'canceled';
        await user.save();
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(400).json({ message: 'Webhook error' });
  }
});

module.exports = router;
