const { userDayKey, daysBetween } = require('./dayKey');

const XP_PER_LEVEL = 200;
const QUEST_STEP_XP = 15;
const DAILY_BONUS_XP = 50;
const MONTHLY_FREEZE_GRANT = 2;

const getDailyWordTarget = (level) => {
  switch (level) {
    case 'intermediate':
      return 5;
    case 'advanced':
      return 7;
    default:
      return 3;
  }
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
  immersionCompleted = false,
  allQuestsDoneToday = false,
}) => {
  const earned = [];
  if (totalWords >= 1) earned.push('first_word');
  if (totalWords >= 50) earned.push('words_50');
  if (totalWords >= 250) earned.push('words_250');
  if (currentStreak >= 7 || longestStreak >= 7) earned.push('streak_7');
  if (currentStreak >= 30 || longestStreak >= 30) earned.push('streak_30');
  if (immersionCompleted) earned.push('first_chat');
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
    topicCompleted: false,
    immersionCompleted: false,
  };
  return true;
};

const enrichUserProfile = (user, { totalWords = 0 } = {}) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;

  const today = userDayKey(user);
  const quests = obj.dailyQuests || {};
  const isToday = quests.date === today;
  const allQuestsDoneToday =
    isToday && quests.reviewCompleted && quests.topicCompleted && quests.immersionCompleted;

  obj.level = computeLevelFromXp(obj.xp);
  obj.xpProgress = xpProgressInLevel(obj.xp);
  obj.badges = computeEarnedBadges({
    totalWords,
    currentStreak: obj.currentStreak || 0,
    longestStreak: obj.longestStreak || 0,
    immersionCompleted: isToday && quests.immersionCompleted,
    allQuestsDoneToday,
  });
  obj.dailyWordTarget = getDailyWordTarget(obj.onboarding?.level);
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
  grantMonthlyFreezes,
  enrichUserProfile,
};
