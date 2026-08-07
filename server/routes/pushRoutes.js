const express = require('express');
const router = express.Router();
const PushSubscription = require('../models/PushSubscription');
const { protect } = require('../middleware/authMiddleware');
const { validate, pushSubscribeSchema, pushUnsubscribeSchema } = require('../middleware/validate');
const { getPublicKey, isPushConfigured, sendToUser } = require('../services/pushService');

// @desc    VAPID ochiq kaliti — brauzer obuna bo'lish uchun ishlatadi
// @route   GET /api/push/public-key
router.get('/public-key', (req, res) => {
  res.json({
    configured: isPushConfigured(),
    publicKey: getPublicKey(),
  });
});

// @desc    Qurilmani ro'yxatdan o'tkazish
// @route   POST /api/push/subscribe
router.post('/subscribe', protect, validate(pushSubscribeSchema), async (req, res) => {
  try {
    const { endpoint, keys } = req.validated.body;

    // Bir xil brauzer qayta obuna bo'lsa dublikat yaratmaymiz.
    // Endpoint boshqa foydalanuvchiga tegishli bo'lishi ham mumkin —
    // masalan umumiy kompyuterda hisob almashtirilgan bo'lsa.
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        user: req.user._id,
        endpoint,
        keys,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
        failureCount: 0,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const count = await PushSubscription.countDocuments({ user: req.user._id });
    res.status(201).json({ message: 'Qurilma ulandi', devices: count });
  } catch (error) {
    console.error('Push subscribe error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Qurilmani o'chirish
// @route   POST /api/push/unsubscribe
router.post('/unsubscribe', protect, validate(pushUnsubscribeSchema), async (req, res) => {
  try {
    const { endpoint } = req.validated.body;
    await PushSubscription.deleteOne({ endpoint, user: req.user._id });
    const count = await PushSubscription.countDocuments({ user: req.user._id });
    res.json({ message: 'Qurilma o\'chirildi', devices: count });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Ulangan qurilmalar soni
// @route   GET /api/push/status
router.get('/status', protect, async (req, res) => {
  const devices = await PushSubscription.countDocuments({ user: req.user._id });
  res.json({ configured: isPushConfigured(), devices });
});

/**
 * Sinov bildirishnomasi.
 *
 * Bu shunchaki qulaylik emas: foydalanuvchi ruxsat berganidan keyin hech
 * narsa ko'rmasa, sozlash ishlaganiga ishonchi bo'lmaydi. Bitta darhol
 * keladigan bildirishnoma butun oqimni tasdiqlaydi.
 *
 * @route POST /api/push/test
 */
router.post('/test', protect, async (req, res) => {
  if (!isPushConfigured()) {
    return res.status(503).json({ message: 'Push sozlanmagan' });
  }

  const result = await sendToUser(req.user._id, {
    title: 'Linguist AI',
    body: 'Bildirishnomalar ishlayapti ✓',
    url: '/',
    tag: 'test',
  });

  if (result.sent === 0) {
    return res.status(400).json({
      message: "Ulangan qurilma topilmadi. Bildirishnomalarni qayta yoqib ko'ring.",
      ...result,
    });
  }
  res.json({ message: 'Yuborildi', ...result });
});

module.exports = router;
