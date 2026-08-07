const crypto = require('crypto');
const User = require('../models/User');
const Word = require('../models/Word');
const { shouldSendReminder, buildReminderContent, SKIP } = require('../utils/reminders');
const { sendMail, dailyReminderEmail, isConfigured } = require('./mailer');
const { sendToUser, isPushConfigured } = require('./pushService');

/**
 * Eslatmalarni yuborish sikli.
 *
 * Render bepul tarifida doimiy ishlaydigan cron yo'q (servis bo'sh turishda
 * o'chadi), shuning uchun bu funksiya tashqi cron chaqiradigan himoyalangan
 * endpoint orqali ishga tushiriladi. Ichki `setInterval` varianti ham bor,
 * lekin u faqat servis uyg'oq bo'lganda ishlaydi.
 *
 * Har ishga tushishda faqat MAHALLIY soati mos kelgan foydalanuvchilar
 * tanlanadi, shuning uchun cron'ni har soat chaqirish yetarli.
 */

/** Bitta yugurishda ko'pi bilan shuncha xat — tasodifiy sikl butun kvotani yemasin */
const MAX_PER_RUN = Number(process.env.REMINDER_MAX_PER_RUN) || 500;

const ensureUnsubscribeToken = async (user) => {
  if (user.notifications?.unsubscribeToken) return user.notifications.unsubscribeToken;
  const token = crypto.randomBytes(24).toString('hex');
  user.notifications = user.notifications || {};
  user.notifications.unsubscribeToken = token;
  return token;
};

/**
 * @returns {Promise<{checked, sent, skipped, failed, reasons}>}
 */
const runReminders = async (now = new Date(), { dryRun = false } = {}) => {
  const stats = { checked: 0, sent: 0, skipped: 0, failed: 0, reasons: {}, byChannel: {} };

  if (!isConfigured() && !isPushConfigured() && !dryRun) {
    // Hech qanday kanal yo'q — jimgina to'xtaymiz, lekin buni bildirib qo'yamiz
    console.warn('Eslatmalar: na MAIL_PROVIDER, na VAPID kalitlari sozlangan');
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  // Faqat eslatma yoqilgan foydalanuvchilar. Onboarding tugamaganlar
  // baribir shouldSendReminder ichida tashlab yuboriladi, lekin ularni
  // so'rovning o'zida ham cheklab, bazaga yukni kamaytiramiz.
  const cursor = User.find({
    'notifications.email.enabled': { $ne: false },
    'onboarding.completed': true,
  })
    .select(
      'name email timezone onboarding currentStreak lastStreakDay dailyQuests notifications streakFreeze createdAt'
    )
    .cursor();

  for await (const user of cursor) {
    if (stats.sent >= MAX_PER_RUN) break;
    stats.checked++;

    const decision = shouldSendReminder(user, now);
    if (!decision.send) {
      stats.skipped++;
      stats.reasons[decision.reason] = (stats.reasons[decision.reason] || 0) + 1;
      continue;
    }

    try {
      const dueCount = await Word.countDocuments({
        user: user._id,
        $or: [{ nextReviewDate: { $lte: now } }, { nextReviewDate: null }],
      });

      const content = buildReminderContent(user, { dueCount });

      /**
       * Kanal tanlash: push bo'lsa push, aks holda email.
       *
       * Ikkalasini birga yuborish spam bo'lardi — bir xil eslatma ikki
       * joydan kelsa foydalanuvchi ikkalasini ham o'chirib qo'yadi.
       * Push afzal: ochilish darajasi emaildan sezilarli yuqori va
       * bildirishnoma darhol ko'rinadi.
       */
      let channel = 'email';
      if (!dryRun) {
        const pushResult = await sendToUser(user._id, {
          title: content.subject,
          body: content.stepsLine,
          url: '/',
          tag: 'daily-reminder',
        });

        if (pushResult.sent > 0) {
          channel = 'push';
        } else {
          const token = await ensureUnsubscribeToken(user);
          await sendMail({
            to: user.email,
            ...dailyReminderEmail(content, {
              appUrl: clientUrl,
              unsubscribeUrl: `${clientUrl.replace(/\/$/, '')}/unsubscribe?token=${token}`,
            }),
          });
        }
      } else {
        // Quruq yugurishda ham token yaratilishini tekshiramiz
        await ensureUnsubscribeToken(user);
      }
      stats.byChannel[channel] = (stats.byChannel[channel] || 0) + 1;

      // Kuniga bir marta kafolatini shu yerda mustahkamlaymiz
      user.notifications.email.lastSentDay = decision.todayKey;
      user.notifications.email.sentCount = (user.notifications.email.sentCount || 0) + 1;
      await user.save();

      stats.sent++;
    } catch (error) {
      stats.failed++;
      console.error(`Eslatma yuborilmadi (${user._id}):`, error.message);
    }
  }

  return stats;
};

/** Ichki interval — faqat ENABLE_INTERNAL_CRON=true bo'lganda */
let timer = null;
const startInternalCron = () => {
  if (process.env.ENABLE_INTERNAL_CRON !== 'true') return null;
  if (timer) return timer;

  const everyMs = 15 * 60 * 1000;
  timer = setInterval(() => {
    runReminders()
      .then((s) => {
        if (s.sent) console.log('Eslatmalar yuborildi:', JSON.stringify(s));
      })
      .catch((err) => console.error('Eslatma siklida xato:', err.message));
  }, everyMs);
  timer.unref?.();
  console.log('Ichki eslatma cron yoqildi (15 daqiqada bir)');
  return timer;
};

const stopInternalCron = () => {
  if (timer) clearInterval(timer);
  timer = null;
};

module.exports = { runReminders, startInternalCron, stopInternalCron, SKIP, MAX_PER_RUN };
