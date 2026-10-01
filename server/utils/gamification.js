const { userDayKey, daysBetween } = require('./dayKey');

const XP_PER_LEVEL = 200;
const QUEST_STEP_XP = 15;
const DAILY_BONUS_XP = 50;
const MONTHLY_FREEZE_GRANT = 2;

/**
 * Kunlik reja → kunlik yangi so'zlar soni.
 *
 * Ilgari `planType` faqat yorliq edi ("Sprint", "Erkinlik") — foydalanuvchi
 * reja tanlardi, lekin ilova o'zini hech o'zgartirmasdi. Endi reja kunlik
 * yukni belgilaydi. Sahnada 10 ta so'z bor, shuning uchun eng yuqori reja
 * butun sahnani o'z ichiga oladi.
 */
const PLAN_WORD_TARGETS = Object.freeze({ sprint: 5, foundation: 7, fluency: 10 });

/** Reja tanlanmagan eski foydalanuvchilar ('standard') — darajaga qarab, avvalgidek */
const LEVEL_WORD_TARGETS = Object.freeze({ beginner: 3, intermediate: 5, advanced: 7 });

/**
 * @param {{level?: string, planType?: string}|string} onboarding — onboarding
 *   obyekti; eski chaqiruvlar uchun daraja satri ham qabul qilinadi
 */
const getDailyWordTarget = (onboarding) => {
  const ob = typeof onboarding === 'string' ? { level: onboarding } : onboarding || {};
  return PLAN_WORD_TARGETS[ob.planType] || LEVEL_WORD_TARGETS[ob.level] || LEVEL_WORD_TARGETS.beginner;
};

const computeLevelFromXp = (xp = 0) => {
  const safeXp = Math.max(0, Number(xp) || 0);
  return Math.floor(safeXp / XP_PER_LEVEL) + 1;
};

const xpProgressInLevel = (xp = 0) => {
  const safeXp = Math.max(0, Number(xp) || 0);
  const inLevel = safeXp % XP_PER_LEVEL;
  return {
    current: inLevel,
    needed: XP_PER_LEVEL,
    percent: Math.round((inLevel / XP_PER_LEVEL) * 100),
    xpToNext: XP_PER_LEVEL - inLevel,
  };
};

const computeEarnedBadges = ({
  totalWords = 0,
  currentStreak = 0,
  longestStreak = 0,
  allQuestsDoneToday = false,
}) => {
  const earned = [];
  if (totalWords >= 1) earned.push('first_word');
  if (totalWords >= 50) earned.push('words_50');
  if (totalWords >= 250) earned.push('words_250');
  if (currentStreak >= 7 || longestStreak >= 7) earned.push('streak_7');
  if (currentStreak >= 30 || longestStreak >= 30) earned.push('streak_30');
  if (allQuestsDoneToday) earned.push('daily_complete');
  return earned;
};

/** Har oy boshida streak muzlatishlarini tiklash */
const grantMonthlyFreezes = (user, todayKey) => {
  const month = todayKey.slice(0, 7); // 'YYYY-MM'
  if (!user.streakFreeze) {
    user.streakFreeze = { available: MONTHLY_FREEZE_GRANT, lastGrantedMonth: month, lastUsedDay: '' };
    return;
  }
  if (user.streakFreeze.lastGrantedMonth !== month) {
    user.streakFreeze.available = MONTHLY_FREEZE_GRANT;
    user.streakFreeze.lastGrantedMonth = month;
  }
};

/**
 * Streak'ni yangilaydi.
 *
 * Ilgari: kun o'tkazib yuborilsa streak darhol 0 ga tushardi va tiklash imkoni yo'q edi.
 * Bu retention uchun eng shafqatsiz mexanizm — bir marta kasal bo'lgan foydalanuvchi
 * 40 kunlik streak'ini yo'qotib, umuman qaytmaydi.
 *
 * Endi: 1 kun o'tkazib yuborilsa muzlatish sarflanadi va streak saqlanadi.
 */
const advanceStreak = (user, todayKey) => {
  grantMonthlyFreezes(user, todayKey);

  const last = user.lastStreakDay;

  if (!last) {
    user.currentStreak = 1;
  } else {
    const gap = daysBetween(last, todayKey);

    if (gap <= 0) {
      // Bugun allaqachon hisoblangan
      return { changed: false, streakFrozen: false };
    }
    if (gap === 1) {
      user.currentStreak += 1;
    } else if (gap === 2 && (user.streakFreeze?.available || 0) > 0) {
      // Roppa-rosa bitta kun o'tkazib yuborildi — muzlatish ishlatamiz
      user.streakFreeze.available -= 1;
      user.streakFreeze.lastUsedDay = todayKey;
      user.currentStreak += 1;
      user.lastStreakDay = todayKey;
      user.lastActiveDate = new Date();
      if (user.currentStreak > user.longestStreak) user.longestStreak = user.currentStreak;
      return { changed: true, streakFrozen: true };
    } else {
      user.currentStreak = 1;
    }
  }

  user.lastStreakDay = todayKey;
  user.lastActiveDate = new Date();
  if (user.currentStreak > user.longestStreak) {
    user.longestStreak = user.currentStreak;
  }
  return { changed: true, streakFrozen: false };
};

/** Kun almashgan bo'lsa kunlik questlarni nollaydi */
const rollDailyQuests = (user, todayKey) => {
  if (user.dailyQuests?.date === todayKey) return false;
  user.dailyQuests = {
    date: todayKey,
    reviewCompleted: false,
    reviewSkipped: false,
    topicCompleted: false,
    listeningCompleted: false,
    reviewedCount: 0,
  };
  return true;
};

const DAILY_STEP_KEYS = { review: 'reviewCompleted', topic: 'topicCompleted' };

/**
 * Kunlik rejaning bitta qadamini belgilaydi va ikkalasi tugagan bo'lsa
 * streak'ni oshiradi. Streak FAQAT shu yerda oshadi.
 *
 * Ilgari streak faqat mijoz chaqiradigan `/auth/sync-quest` da oshardi,
 * `/topics/finish` esa uni umuman chaqirmasdi. Natijada foydalanuvchi avval
 * takrorlab, keyin sahnani tugatsa, o'sha kuni streak oshmay qolardi. Bundan
 * tashqari sync-quest mijozga ishonardi — ikki so'rov bilan streak olish
 * mumkin edi. Endi qadamni faqat server, haqiqiy ish bajarilganda belgilaydi.
 *
 * Mutatsiya qiladi, saqlamaydi — chaqiruvchi `user.save()` qiladi.
 */
const completeDailyStep = (user, step, todayKey) => {
  const key = DAILY_STEP_KEYS[step];
  if (!key) throw new Error(`Noma'lum qadam: ${step}`);

  rollDailyQuests(user, todayKey);

  let xpAwarded = 0;
  const stepNewlyCompleted = !user.dailyQuests[key];
  if (stepNewlyCompleted) {
    user.dailyQuests[key] = true;
    user.xp = (user.xp || 0) + QUEST_STEP_XP;
    xpAwarded += QUEST_STEP_XP;
  }

  let streak = { changed: false, streakFrozen: false };
  if (user.dailyQuests.reviewCompleted && user.dailyQuests.topicCompleted) {
    streak = advanceStreak(user, todayKey);
    if (streak.changed) {
      user.xp += DAILY_BONUS_XP;
      xpAwarded += DAILY_BONUS_XP;
    }
  }

  return {
    stepNewlyCompleted,
    xpAwarded,
    streakUpdated: streak.changed,
    streakFrozen: streak.streakFrozen,
    planCompleted: Boolean(user.dailyQuests.reviewCompleted && user.dailyQuests.topicCompleted),
  };
};

/** Foydalanuvchiga ko'rsatiladigan xabar */
const dailyStepMessage = ({ xpAwarded, streakUpdated, streakFrozen }) => {
  if (streakUpdated && streakFrozen) {
    return 'Kunlik reja tugadi! Streak muzlatish ishlatildi, ketma-ketlik saqlandi 🧊';
  }
  if (streakUpdated) return 'Kunlik reja tugadi! Streak yangilandi 🔥';
  if (xpAwarded > 0) return 'Qadam bajarildi!';
  return null;
};

const enrichUserProfile = (user, { totalWords = 0, knownWords = 0, course = null } = {}) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;

  const today = userDayKey(user);
  const quests = obj.dailyQuests || {};
  const isToday = quests.date === today;
  const allQuestsDoneToday =
    isToday && quests.reviewCompleted && quests.topicCompleted;

  obj.level = computeLevelFromXp(obj.xp);
  obj.xpProgress = xpProgressInLevel(obj.xp);
  obj.badges = computeEarnedBadges({
    totalWords,
    currentStreak: obj.currentStreak || 0,
    longestStreak: obj.longestStreak || 0,
    allQuestsDoneToday,
  });
  obj.dailyWordTarget = getDailyWordTarget(obj.onboarding);
  // Asosiy o'sish ko'rsatkichlari: yodlangan so'zlar va kursdagi CEFR yo'li.
  // XP ichkarida qoladi (eski mijozlar va nishonlar uchun), lekin ko'rsatilmaydi.
  obj.totalWords = totalWords;
  obj.knownWords = knownWords;
  obj.course = course;
  obj.today = today;
  obj.streakFreezesLeft = obj.streakFreeze?.available ?? 0;

  return obj;
};

module.exports = {
  XP_PER_LEVEL,
  QUEST_STEP_XP,
  DAILY_BONUS_XP,
  MONTHLY_FREEZE_GRANT,
  getDailyWordTarget,
  computeLevelFromXp,
  xpProgressInLevel,
  computeEarnedBadges,
  advanceStreak,
  rollDailyQuests,
  completeDailyStep,
  dailyStepMessage,
  grantMonthlyFreezes,
  enrichUserProfile,
};
