const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  isTelegramConfigured,
  botUsername,
  createLinkCode,
  deepLink,
  isValidWebhookSecret,
  sendMessage,
} = require('../services/telegramService');
const { handleUpdate } = require('../services/telegramBot');

const statusOf = (user) => ({
  configured: isTelegramConfigured(),
  linked: Boolean(user.telegram?.chatId),
  username: user.telegram?.username || null,
  linkedAt: user.telegram?.linkedAt || null,
  botUsername: isTelegramConfigured() ? botUsername() : null,
});

// @route GET /api/telegram/status
router.get('/status', protect, (req, res) => {
  res.json(statusOf(req.user));
});

/**
 * Bog'lash havolasini yaratish.
 * Foydalanuvchi havolani ochib botda "Start" bosadi — bot kodni webhook
 * orqali oladi va hisobni chatga bog'laydi. Kod bir martalik va 15 daqiqa
 * yashaydi; bazada faqat hash saqlanadi.
 *
 * @route POST /api/telegram/link
 */
router.post('/link', protect, async (req, res) => {
  if (!isTelegramConfigured()) {
    return res.status(503).json({ message: 'Telegram bot sozlanmagan', code: 'TELEGRAM_NOT_CONFIGURED' });
  }
  try {
    const { code, hash, expires } = createLinkCode();
    req.user.telegram = req.user.telegram || {};
    req.user.telegram.linkCodeHash = hash;
    req.user.telegram.linkCodeExpires = expires;
    await req.user.save();
    res.json({ url: deepLink(code), expiresAt: expires });
  } catch (error) {
    console.error('Telegram link error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route DELETE /api/telegram/link
router.delete('/link', protect, async (req, res) => {
  try {
    const chatId = req.user.telegram?.chatId;
    req.user.telegram = { chatId: undefined, username: '', linkedAt: null, linkCodeHash: undefined, linkCodeExpires: null };
    await req.user.save();
    if (chatId) {
      // Natija muhim emas — bot bloklangan bo'lsa ham uzish bajarildi
      await sendMessage(chatId, "Hisob ilovadan uzildi. Eslatmalar endi bu yerga kelmaydi.");
    }
    res.json(statusOf(req.user));
  } catch (error) {
    console.error('Telegram unlink error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * Telegram webhook.
 * `X-Telegram-Bot-Api-Secret-Token` — setWebhook'da berilgan sir; busiz
 * istalgan odam soxta "/start <kod>" yuborib ko'rishi mumkin edi.
 * Xato bo'lsa ham 200 qaytaramiz: aks holda Telegram shu yangilanishni
 * qayta-qayta yuboraveradi.
 *
 * @route POST /api/telegram/webhook
 */
router.post('/webhook', async (req, res) => {
  if (!isValidWebhookSecret(req.headers['x-telegram-bot-api-secret-token'])) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    await handleUpdate(req.body);
  } catch (error) {
    console.error('Telegram webhook error:', error);
  }
  res.json({ ok: true });
});

module.exports = router;
