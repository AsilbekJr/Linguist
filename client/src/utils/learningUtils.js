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
