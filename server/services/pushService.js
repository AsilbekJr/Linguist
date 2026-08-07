const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

/**
 * Web Push.
 *
 * VAPID kalitlari `npm run push:keys` bilan generatsiya qilinadi va env'ga
 * yoziladi. Kalitlar yo'q bo'lsa modul jimgina o'chiq holatda qoladi —
 * eslatmalar email orqali ketaveradi va hech narsa buzilmaydi.
 */

const PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@linguist.uz';

let configured = false;
if (PUBLIC_KEY && PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC_KEY, PRIVATE_KEY);
    configured = true;
  } catch (error) {
    console.error('VAPID sozlashda xato:', error.message);
  }
}

const isPushConfigured = () => configured;
const getPublicKey = () => (configured ? PUBLIC_KEY : null);

/** Ketma-ket shuncha xatodan keyin obuna o'chiriladi */
const MAX_FAILURES = 3;

/**
 * Bitta obunaga xabar yuborish.
 * @returns {Promise<{ok: boolean, removed?: boolean, reason?: string}>}
 */
const sendToSubscription = async (subscription, payload) => {
  if (!configured) return { ok: false, reason: 'not_configured' };

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      },
      JSON.stringify(payload),
      { TTL: 12 * 60 * 60 } // 12 soat: ertangi kun uchun eskirgan eslatma kerak emas
    );

    if (subscription.failureCount > 0) {
      subscription.failureCount = 0;
    }
    subscription.lastSentAt = new Date();
    await subscription.save();

    return { ok: true };
  } catch (error) {
    const status = error.statusCode;

    // 404/410 — obuna brauzer tomonidan bekor qilingan. Uni saqlab qo'yish
    // keraksiz: har safar xatoga uriladi va statistikani buzadi.
    if (status === 404 || status === 410) {
      await PushSubscription.deleteOne({ _id: subscription._id });
      return { ok: false, removed: true, reason: 'expired' };
    }

    subscription.failureCount = (subscription.failureCount || 0) + 1;
    if (subscription.failureCount >= MAX_FAILURES) {
      await PushSubscription.deleteOne({ _id: subscription._id });
      return { ok: false, removed: true, reason: 'too_many_failures' };
    }
    await subscription.save();

    return { ok: false, reason: `status_${status || 'unknown'}` };
  }
};

/**
 * Foydalanuvchining barcha qurilmalariga yuborish.
 * @returns {Promise<{sent: number, removed: number, failed: number}>}
 */
const sendToUser = async (userId, payload) => {
  const result = { sent: 0, removed: 0, failed: 0 };
  if (!configured) return result;

  const subs = await PushSubscription.find({ user: userId });
  for (const sub of subs) {
    const res = await sendToSubscription(sub, payload);
    if (res.ok) result.sent++;
    else if (res.removed) result.removed++;
    else result.failed++;
  }
  return result;
};

/** Foydalanuvchida ishlaydigan obuna bormi */
const hasActiveSubscription = async (userId) => {
  if (!configured) return false;
  return (await PushSubscription.countDocuments({ user: userId })) > 0;
};

module.exports = {
  isPushConfigured,
  getPublicKey,
  sendToSubscription,
  sendToUser,
  hasActiveSubscription,
  MAX_FAILURES,
};
