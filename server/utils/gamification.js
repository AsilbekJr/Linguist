const XP_PER_LEVEL = 200;
const QUEST_STEP_XP = 15;
const DAILY_BONUS_XP = 50;

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
  immersionCompleted = false,
  allQuestsDoneToday = false,
}) => {
  const earned = [];
  if (totalWords >= 1) earned.push('first_word');
  if (totalWords >= 50) earned.push('words_50');
  if (currentStreak >= 7) earned.push('streak_7');
  if (immersionCompleted) earned.push('first_chat');
  if (allQuestsDoneToday) earned.push('daily_complete');
  return earned;
};

const enrichUserProfile = (user, { totalWords = 0 } = {}) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;

  const today = new Date().toISOString().split('T')[0];
  const quests = obj.dailyQuests || {};
  const isToday = quests.date === today;
  const allQuestsDoneToday =
    isToday &&
    quests.reviewCompleted &&
    quests.topicCompleted &&
    quests.immersionCompleted;

  obj.level = computeLevelFromXp(obj.xp);
  obj.xpProgress = xpProgressInLevel(obj.xp);
  obj.badges = computeEarnedBadges({
    totalWords,
    currentStreak: obj.currentStreak || 0,
    immersionCompleted: isToday && quests.immersionCompleted,
    allQuestsDoneToday,
  });
  obj.dailyWordTarget = getDailyWordTarget(obj.onboarding?.level);

  return obj;
};

module.exports = {
  XP_PER_LEVEL,
  QUEST_STEP_XP,
  DAILY_BONUS_XP,
  getDailyWordTarget,
  computeLevelFromXp,
  xpProgressInLevel,
  computeEarnedBadges,
  enrichUserProfile,
};
