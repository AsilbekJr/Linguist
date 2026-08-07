const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { validate, checkoutSchema } = require('../middleware/validate');
const { createCheckoutSession, createPortalSession } = require('../services/stripeService');

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

/**
 * Payme/Click stub'lari olib tashlandi — ular faqat 501 tashlardi va
 * "to'lov mavjud" degan noto'g'ri taassurot berardi.
 *
 * Real integratsiya alohida ish: O'zbekiston bozorida Stripe kartalar bilan
 * ishlamaydi, ya'ni hozir mahsulotdan daromad olishning yo'li yo'q. Bu
 * Faza 3 ning asosiy vazifasi.
 */

module.exports = router;
