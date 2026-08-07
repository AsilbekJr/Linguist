const { getDailyWordTarget } = require('./gamification');

/** Beginner users start on easier curated days (topics.json day numbers) */
const BEGINNER_DAY_SEQUENCE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31];

const SCENARIO_META = {
  1: { emoji: '🏠', storyUz: "Bugun kundalik hayotda eng ko'p ishlatiladigan so'zlarni o'rganamiz — keyin mini-test va takrorlash." },
  2: { emoji: '💼', storyUz: "Ish joyida gaplashish va email yozish uchun kerakli so'zlar — professional lekin sodda." },
  3: { emoji: '🎓', storyUz: "O'qish va matn o'qishda uchraydigan akademik so'zlar — imtihon va kurs uchun." },
};

const getScenarioMeta = (day) => {
  const key = ((day - 1) % 3) + 1;
  return SCENARIO_META[key] || { emoji: '📚', storyUz: "Bugungi mavzuda yangi so'zlarni o'rganib, bugun takrorlaysiz." };
};

const resolveTopicDay = (currentDay, learnerLevel) => {
  const maxDay = BEGINNER_DAY_SEQUENCE.length;
  const safeDay = Math.min(Math.max(1, currentDay), maxDay);
  if (learnerLevel === 'beginner') {
    return BEGINNER_DAY_SEQUENCE[safeDay - 1] || safeDay;
  }
  return safeDay;
};

/** Bugungi sessiya so'zlari — har doim wordTarget ta (saqlangan/saqlanmagan aralash) */
const pickDailySessionWords = (topicWords, savedWordsLower, wordTarget) => {
  const dailyWords = (topicWords || []).slice(0, wordTarget);
  const savedCount = dailyWords.filter((w) =>
    savedWordsLower.includes(w.word.toLowerCase())
  ).length;
  const unsavedRemaining = (topicWords || []).filter(
    (w) => !savedWordsLower.includes(w.word.toLowerCase())
  ).length;
  return {
    dailyWords,
    savedCount,
    requiredCount: dailyWords.length,
    totalToday: topicWords?.length || 0,
    unsavedRemaining,
  };
};

/** Kunlik sahnadan qo'shilgan so'zlar bugun takrorlashda chiqsin */
const getTopicReviewDate = () => new Date();

const getTomorrowReviewDate = getTopicReviewDate;

const buildBacklog = (topicsList, targetDay, savedWordsLower, limit = 15) => {
  const backlog = [];
  for (let i = 1; i < targetDay && backlog.length < limit; i++) {
    const topicOfDay = topicsList.find((t) => t.day === i);
    if (!topicOfDay?.words) continue;
    for (const w of topicOfDay.words) {
      if (!savedWordsLower.includes(w.word.toLowerCase())) {
        backlog.push({ ...w, fromDay: i });
        if (backlog.length >= limit) break;
      }
    }
  }
  return backlog;
};

/**
 * Mini-test uchun ishonchli chalg'ituvchi variantlar.
 *
 * Ilgari mijozda qattiq yozilgan ro'yxat ishlatilardi:
 *   ['Boshqa ma\'no', 'Noto\'g\'ri tarjima', 'Aksincha', 'Tanilmadi']
 * Foydalanuvchi bir necha savoldan keyin shablonni payqab, so'zni bilmasdan
 * ham 100% to'plardi. Endi variantlar butun kontent bazasidagi HAQIQIY
 * tarjimalardan olinadi — test haqiqatan bilimni tekshiradi.
 */
const buildDistractorPool = (topicsList, excludeWords = []) => {
  const exclude = new Set(excludeWords.map((w) => w.translation));
  const pool = new Set();
  for (const topic of topicsList) {
    for (const w of topic.words || []) {
      if (w.translation && !exclude.has(w.translation)) {
        pool.add(w.translation);
      }
    }
  }
  return [...pool];
};

module.exports = {
  getDailyWordTarget,
  resolveTopicDay,
  pickDailySessionWords,
  getTopicReviewDate,
  getScenarioMeta,
  buildBacklog,
  buildDistractorPool,
};
