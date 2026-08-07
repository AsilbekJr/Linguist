const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { validate, notificationPrefsSchema, unsubscribeSchema } = require('../middleware/validate');
const { runReminders } = require('../services/reminderRunner');

// @desc    Joriy sozlamalar
// @route   GET /api/notifications/preferences
router.get('/preferences', protect, async (req, res) => {
  const prefs = req.user.notifications?.email || {};
  res.json({
    enabled: prefs.enabled !== false,
    hour: Number.isInteger(prefs.hour) ? prefs.hour : 19,
    timezone: req.user.timezone,
    lastSentDay: prefs.lastSentDay || null,
  });
});

// @desc    Sozlamalarni yangilash
// @route   PUT /api/notifications/preferences
router.put('/preferences', protect, validate(notificationPrefsSchema), async (req, res) => {
  try {
    const { enabled, hour } = req.validated.body;

    req.user.notifications = req.user.notifications || {};
    req.user.notifications.email = req.user.notifications.email || {};
    if (enabled !== undefined) req.user.notifications.email.enabled = enabled;
    if (hour !== undefined) req.user.notifications.email.hour = hour;

    await req.user.save();

    res.json({
      enabled: req.user.notifications.email.enabled !== false,
      hour: req.user.notifications.email.hour ?? 19,
      timezone: req.user.timezone,
    });
  } catch (error) {
    console.error('Notification prefs error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Obunani bekor qilish.
 *
 * ATAYLAB login talab qilmaydi: xatdagi havolani bosgan odam parolini eslay
 * olmasa ham chiqib keta olishi kerak. Aks holda u "spam" tugmasini bosadi va
 * bu butun domenning yetkazib berish obro'siga zarar qiladi.
 *
 * @route POST /api/notifications/unsubscribe
 */
router.post('/unsubscribe', validate(unsubscribeSchema), async (req, res) => {
  try {
    const { token } = req.validated.body;

    const user = await User.findOne({ 'notifications.unsubscribeToken': token });
    if (!user) {
      // Token noto'g'ri bo'lsa ham muvaffaqiyat deymiz — bu endpoint orqali
      // token taxmin qilishni ma'nosiz qiladi
      return res.json({ message: "Eslatmalar o'chirildi." });
    }

    user.notifications.email.enabled = false;
    await user.save();

    res.json({ message: "Eslatmalar o'chirildi.", email: user.email });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Tashqi cron uchun endpoint.
 *
 * Render bepul tarifida doimiy jarayon yo'q, shuning uchun eslatmalarni
 * tashqi cron (cron-job.org, GitHub Actions, Render Cron Job) soatiga bir
 * marta chaqiradi. Sir bilan himoyalangan.
 *
 * @route POST /api/notifications/run
 */
router.post('/run', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(503).json({ message: 'CRON_SECRET sozlanmagan' });
  }

  const provided = req.headers['x-cron-secret'] || '';
  // Doimiy vaqtli taqqoslash — timing attack orqali sirni topib bo'lmasin
  const a = Buffer.from(String(provided));
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const stats = await runReminders(new Date(), { dryRun: req.query.dryRun === '1' });
    res.json(stats);
  } catch (error) {
    console.error('Reminder run error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
