const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { validate, checkoutSchema } = require('../middleware/validate');
const { createCheckoutSession, createPortalSession } = require('../services/stripeService');
const { createPaymeCheckout, createClickCheckout } = require('../services/paymeAdapter');

const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

router.get('/subscription', protect, async (req, res) => {
  res.json({
    plan: req.user.getEffectivePlan(),
    subscription: req.user.subscription,
    usage: req.user.usage,
  });
});

router.post('/checkout', protect, validate(checkoutSchema), async (req, res) => {
  try {
    const { plan } = req.validated.body;
    const session = await createCheckoutSession({
      user: req.user,
      plan,
      successUrl: `${clientUrl}/pricing?success=1`,
      cancelUrl: `${clientUrl}/pricing?canceled=1`,
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(503).json({ message: error.message || 'Billing unavailable' });
  }
});

router.post('/portal', protect, async (req, res) => {
  try {
    const session = await createPortalSession(req.user, `${clientUrl}/pricing`);
    res.json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);
    res.status(503).json({ message: error.message || 'Billing portal unavailable' });
  }
});

router.post('/payme/checkout', protect, async (req, res) => {
  try {
    const result = await createPaymeCheckout(req.user, req.body);
    res.json(result);
  } catch (error) {
    res.status(501).json({ message: error.message });
  }
});

router.post('/click/checkout', protect, async (req, res) => {
  try {
    const result = await createClickCheckout(req.user, req.body);
    res.json(result);
  } catch (error) {
    res.status(501).json({ message: error.message });
  }
});

module.exports = router;
