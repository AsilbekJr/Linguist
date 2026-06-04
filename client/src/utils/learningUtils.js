/** XP required per level (level 1 starts at 0 XP) */
export const XP_PER_LEVEL = 200;

export const getDailyWordTarget = (level) => {
  switch (level) {
    case 'intermediate':
      return 5;
    case 'advanced':
      return 7;
    case 'beginner':
    default:
      return 3;
  }
};

export const computeLevelFromXp = (xp = 0) => {
  const safeXp = Math.max(0, Number(xp) || 0);
  return Math.floor(safeXp / XP_PER_LEVEL) + 1;
};

export const xpProgressInLevel = (xp = 0) => {
  const safeXp = Math.max(0, Number(xp) || 0);
  const inLevel = safeXp % XP_PER_LEVEL;
  return {
    current: inLevel,
    needed: XP_PER_LEVEL,
    percent: Math.round((inLevel / XP_PER_LEVEL) * 100),
    xpToNext: XP_PER_LEVEL - inLevel,
  };
};

export const BADGE_DEFINITIONS = [
  { id: 'first_word', title: 'Birinchi so\'z', description: 'Lug\'atga birinchi so\'z qo\'shildi', icon: '📝' },
  { id: 'words_50', title: '50 so\'z', description: 'Lug\'atda 50 ta so\'z', icon: '📚' },
  { id: 'streak_7', title: '7 kunlik streak', description: 'Ketma-ket 7 kun faol', icon: '🔥' },
  { id: 'first_chat', title: 'Birinchi suhbat', description: 'AI bilan birinchi suhbat', icon: '💬' },
  { id: 'daily_complete', title: 'Kunlik reja', description: 'Birinchi marta kunlik reja 100%', icon: '✅' },
];

export const computeEarnedBadges = ({ totalWords = 0, currentStreak = 0, immersionCompleted = false, allQuestsDoneToday = false }) => {
  const earned = [];
  if (totalWords >= 1) earned.push('first_word');
  if (totalWords >= 50) earned.push('words_50');
  if (currentStreak >= 7) earned.push('streak_7');
  if (immersionCompleted) earned.push('first_chat');
  if (allQuestsDoneToday) earned.push('daily_complete');
  return earned;
};

export const getGoalRecommendation = (goal) => {
  switch (goal) {
    case 'vocabulary':
      return { label: 'Bugun lug\'atga e\'tibor', path: '/topic', hint: 'Yangi so\'zlar va takrorlash' };
    case 'speaking':
      return { label: 'Bugun gapirishga e\'tibor', path: '/roleplay', hint: 'Roleplay va Speaking Lab' };
    case 'general':
    default:
      return { label: 'Kunlik 3 qadam', path: '/', hint: 'Yangi so\'z → takrorlash → amaliyot' };
  }
};
