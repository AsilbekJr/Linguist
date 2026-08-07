const { userDayKey, dayKey, daysBetween } = require('./dayKey');

/**
 * Kunlik eslatmalar.
 *
 * Nega kerak: kontent, SRS va streak joyida, lekin foydalanuvchini QAYTARADIGAN
 * hech narsa yo'q edi. Streak mexanizmi faqat ilova ochilganda ishlaydi —
 * odam ilovani ochishni unutsa, streak ham, muzlatish ham foydasiz.
 *
 * Tamoyillar:
 *  1. Faqat foydali paytda. Kunlik reja allaqachon bajarilgan bo'lsa xat yubormaymiz.
 *  2. Kuniga bir marta, foydalanuvchining MAHALLIY vaqtida.
 *  3. Uzoq vaqt kirmaganlarga to'xtaymiz — bu spam va pochta obro'siga zarar.
 *  4. Xabar mazmunli: "kel o'qi" emas, balki aynan nima yo'qotilishi aytiladi.
 */

/** Eslatma yuborilmaydigan sabablar — telemetriya va testlar uchun aniq nomlar */
const SKIP = {
  DISABLED: 'disabled',
  NO_EMAIL: 'no_email',
  WRONG_HOUR: 'wrong_hour',
  ALREADY_SENT: 'already_sent',
  PLAN_DONE: 'plan_done',
  ONBOARDING: 'onboarding_incomplete',
  DORMANT: 'dormant',
};

/** Shu kundan keyin faol bo'lmagan foydalanuvchiga eslatma yubormaymiz */
const DORMANT_AFTER_DAYS = 30;

/** Foydalanuvchining mahalliy soati (0-23) */
const localHour = (user, now) =>
  Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: user?.timezone || 'Asia/Tashkent',
      hour: '2-digit',
      hour12: false,
    }).format(now)
  ) % 24;

/**
 * Shu foydalanuvchiga hozir eslatma yuborish kerakmi?
 * Sof funksiya — DB'ga tegmaydi, testda holat qurish oson.
 *
 * @returns {{ send: boolean, reason?: string, todayKey: string }}
 */
const shouldSendReminder = (user, now = new Date()) => {
  const todayKey = userDayKey(user, now);
  const prefs = user.notifications?.email || {};

  if (!user.email) return { send: false, reason: SKIP.NO_EMAIL, todayKey };
  if (prefs.enabled === false) return { send: false, reason: SKIP.DISABLED, todayKey };

  // Onboarding tugamagan foydalanuvchi hali ilovani ko'rmagan — nag qilmaymiz
  if (!user.onboarding?.completed) {
    return { send: false, reason: SKIP.ONBOARDING, todayKey };
  }

  // Uzoq vaqt kirmagan — to'xtaymiz
  if (user.lastStreakDay) {
    const idleDays = daysBetween(user.lastStreakDay, todayKey);
    if (idleDays > DORMANT_AFTER_DAYS) {
      return { send: false, reason: SKIP.DORMANT, todayKey };
    }
  } else if (user.createdAt) {
    const createdKey = dayKey(user.createdAt, user.timezone);
    if (daysBetween(createdKey, todayKey) > DORMANT_AFTER_DAYS) {
      return { send: false, reason: SKIP.DORMANT, todayKey };
    }
  }

  if (prefs.lastSentDay === todayKey) {
    return { send: false, reason: SKIP.ALREADY_SENT, todayKey };
  }

  const preferredHour = Number.isInteger(prefs.hour) ? prefs.hour : 19;
  if (localHour(user, now) !== preferredHour) {
    return { send: false, reason: SKIP.WRONG_HOUR, todayKey };
  }

  // Bugungi reja allaqachon bajarilgan bo'lsa eslatma faqat bezovta qiladi
  const quests = user.dailyQuests || {};
  const isToday = quests.date === todayKey;
  const allDone =
    isToday && quests.reviewCompleted && quests.topicCompleted && quests.immersionCompleted;
  if (allDone) {
    return { send: false, reason: SKIP.PLAN_DONE, todayKey };
  }

  return { send: true, todayKey };
};

/**
 * Xabar matnini quradi.
 *
 * Umumiy "mashq qilishni unutmang" xabari ishlamaydi. Foydalanuvchi aynan
 * NIMANI yo'qotishini bilishi kerak — streak, muzlatish yoki kutayotgan so'zlar.
 */
const buildReminderContent = (user, { dueCount = 0 } = {}) => {
  const name = user.name || 'Do\'stim';
  const streak = user.currentStreak || 0;
  const freezes = user.streakFreeze?.available ?? 0;
  const quests = user.dailyQuests || {};

  const remaining = [];
  if (!quests.topicCompleted) remaining.push('Kunlik sahna');
  if (!quests.reviewCompleted) remaining.push('Takrorlash');
  if (!quests.immersionCompleted) remaining.push('Amaliyot');

  let subject;
  let headline;

  if (streak >= 2) {
    subject = `🔥 ${streak} kunlik ketma-ketligingiz bugun uziladi`;
    headline =
      freezes > 0
        ? `${streak} kunlik ketma-ketligingiz xavf ostida. Sizda ${freezes} ta muzlatish bor, lekin uni bugun sarflashning hojati yo'q.`
        : `${streak} kunlik ketma-ketligingiz xavf ostida va muzlatishingiz qolmagan.`;
  } else if (dueCount > 0) {
    subject = `${dueCount} ta so'z takrorlashni kutmoqda`;
    headline = `Bugun ${dueCount} ta so'z takrorlash vaqti keldi. Kechiktirsangiz ular unutila boshlaydi.`;
  } else {
    subject = 'Bugungi 3 qadam sizni kutmoqda';
    headline = "Bugungi reja hali boshlanmagan. 10-15 daqiqa yetarli.";
  }

  const stepsLine = remaining.length
    ? `Qolgan qadamlar: ${remaining.join(' · ')}`
    : 'Bugungi reja deyarli tugadi.';

  return { subject, headline, stepsLine, remaining, streak, dueCount };
};

module.exports = {
  SKIP,
  DORMANT_AFTER_DAYS,
  localHour,
  shouldSendReminder,
  buildReminderContent,
};
