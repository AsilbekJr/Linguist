const { getDailyWordTarget } = require('./gamification');

/**
 * CEFR → ilovadagi daraja va aksincha.
 *
 * Ilgari bu yerda `BEGINNER_DAY_SEQUENCE = [1,2,3,...,31]` bor edi va
 * `resolveTopicDay` uni "beginner uchun oson kunlar" deb ishlatardi. Lekin bu
 * massiv AYNIYAT edi — ya'ni beginner ham, advanced ham bir xil 1-kundan
 * boshlardi va tanlangan daraja kontentga umuman ta'sir qilmasdi.
 * Bundan tashqari uzunlik 31 ga qotirilgan edi, kontent esa 24 kun.
 */
const LEVEL_TO_CEFR = {
  beginner: 'A1',
  intermediate: 'B1',
  advanced: 'B2',
};

/**
 * Foydalanuvchi darajasiga mos birinchi kun.
 * Kontentning o'zidan hisoblanadi — yangi blok qo'shilganda bu yer o'zgarmaydi.
 */
const getStartDayForLevel = (topicsList, learnerLevel) => {
  const targetCefr = LEVEL_TO_CEFR[learnerLevel] || 'A1';
  const exact = topicsList.find((t) => t.cefr === targetCefr);
  if (exact) return exact.day;

  // Aynan shu daraja hali yozilmagan (masalan B2) — mavjud eng yuqorisidan boshlaymiz
  const order = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const targetRank = order.indexOf(targetCefr);
  const candidates = topicsList
    .filter((t) => order.indexOf(t.cefr) <= targetRank)
    .sort((a, b) => order.indexOf(b.cefr) - order.indexOf(a.cefr) || a.day - b.day);
  return candidates[0]?.day || 1;
};

const SCENARIO_META = {
  1: { emoji: '🏠', storyUz: "Bugun kundalik hayotda eng ko'p ishlatiladigan so'zlarni o'rganamiz — keyin mini-test va takrorlash." },
  2: { emoji: '💼', storyUz: "Ish joyida gaplashish va email yozish uchun kerakli so'zlar — professional lekin sodda." },
  3: { emoji: '🎓', storyUz: "O'qish va matn o'qishda uchraydigan akademik so'zlar — imtihon va kurs uchun." },
};

const getScenarioMeta = (day) => {
  const key = ((day - 1) % 3) + 1;
  return SCENARIO_META[key] || { emoji: '📚', storyUz: "Bugungi mavzuda yangi so'zlarni o'rganib, bugun takrorlaysiz." };
};

/**
 * `currentDay` endi to'g'ridan-to'g'ri kontent kuni.
 * Boshlanish nuqtasi placement natijasiga qarab `TopicProgress.currentDay`
 * ga yoziladi, shuning uchun bu yerda darajaga qarab qayta xaritalash kerak emas.
 */
const resolveTopicDay = (currentDay, topicsList) => {
  const maxDay = Array.isArray(topicsList) && topicsList.length ? topicsList.length : 1;
  return Math.min(Math.max(1, Number(currentDay) || 1), maxDay);
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
  LEVEL_TO_CEFR,
  getStartDayForLevel,
  resolveTopicDay,
  pickDailySessionWords,
  getTopicReviewDate,
  getScenarioMeta,
  buildBacklog,
  buildDistractorPool,
};
