/**
 * Oraliqli takrorlash (SM-2 variantı).
 *
 * Ilgari nima bo'lgan edi:
 *   const stages = [1, 3, 7, 14, 30];
 *   to'g'ri  → stage + 1
 *   xato     → stage - 1
 *   5-bosqich → mastered = true, nextReviewDate = null   ← so'z ABADIY yo'qoladi
 *
 * Uch jiddiy nuqson:
 *  1. Har bir so'z bir xil qiyinlikda deb hisoblanardi — "the" va "ubiquitous" bir xil jadval.
 *  2. Xato faqat 1 pog'ona pasaytirardi. SM-2 bo'yicha xato = intervalni qayta boshlash.
 *  3. `mastered` — bu unutish egri chizig'ini inkor qilish. 5 marta to'g'ri javob
 *     "umrbod esda qoldi" degani emas. Endi so'z hech qachon butunlay chiqib ketmaydi,
 *     shunchaki intervali oylarga cho'ziladi.
 */

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;
const MAX_INTERVAL_DAYS = 365;

/** Baholar — foydalanuvchi 4 ta tugmadan birini bosadi */
const GRADE = {
  AGAIN: 0, // umuman eslay olmadim
  HARD: 1, // qiynalib esladim
  GOOD: 2, // esladim
  EASY: 3, // juda oson edi
};

const GRADE_VALUES = new Set(Object.values(GRADE));
const isValidGrade = (g) => Number.isInteger(g) && GRADE_VALUES.has(g);

/** Binary "bildim/bilmadim" ni 4 darajali shkalaga o'tkazish (flashcard/quiz rejimlari uchun) */
const gradeFromBoolean = (known) => (known ? GRADE.GOOD : GRADE.AGAIN);

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Intervalga ±5% tasodifiy og'ish qo'shadi.
 * Busiz bir kunda qo'shilgan 20 ta so'z 30 kundan keyin ham bir kunda qaytadi
 * va foydalanuvchi devorga uriladi.
 */
const fuzz = (days) => {
  // Qisqa intervallarda tasodifiy og'ish foyda emas, zarar: 3 kunlik interval
  // 2 kunga tushib, o'rganish bosqichini buzadi. Faqat uzun intervallarda qo'llaymiz.
  if (days < 7) return days;
  const spread = Math.round(days * 0.05);
  if (spread < 1) return days;
  return days + Math.floor(Math.random() * (spread * 2 + 1)) - spread;
};

/**
 * Eski `reviewStage` modelidan SM-2 holatiga ko'chirish.
 * Mavjud foydalanuvchilar progressini yo'qotmaslik uchun.
 */
const migrateLegacyState = (word) => {
  const legacyIntervals = [0, 1, 3, 7, 14, 30];
  const stage = clamp(Number(word.reviewStage) || 0, 0, 5);
  return {
    easeFactor: DEFAULT_EASE,
    intervalDays: legacyIntervals[stage] ?? 0,
    repetitions: stage,
    lapses: 0,
  };
};

/** Hujjatdan joriy SM-2 holatini o'qish (yo'q bo'lsa — migratsiya) */
const readState = (word) => {
  if (word.easeFactor == null || word.intervalDays == null) {
    return migrateLegacyState(word);
  }
  return {
    easeFactor: Number(word.easeFactor) || DEFAULT_EASE,
    intervalDays: Number(word.intervalDays) || 0,
    repetitions: Number(word.repetitions) || 0,
    lapses: Number(word.lapses) || 0,
  };
};

/**
 * Keyingi holatni hisoblaydi. Sof funksiya — test qilish oson.
 * @returns {{easeFactor, intervalDays, repetitions, lapses, nextReviewDate, isLapse}}
 */
const schedule = (word, grade, now = new Date()) => {
  const state = readState(word);
  let { easeFactor, intervalDays, repetitions, lapses } = state;
  let isLapse = false;

  if (grade === GRADE.AGAIN) {
    // Unutildi — intervalni qayta boshlaymiz, lekin ease'ni jazolaymiz
    isLapse = true;
    lapses += 1;
    repetitions = 0;
    easeFactor = Math.max(MIN_EASE, easeFactor - 0.2);
    intervalDays = 0; // shu sessiyaning o'zida qaytadi
  } else {
    if (grade === GRADE.HARD) {
      easeFactor = Math.max(MIN_EASE, easeFactor - 0.15);
      intervalDays = repetitions === 0 ? 1 : Math.max(1, Math.round(intervalDays * 1.2));
    } else if (grade === GRADE.EASY) {
      easeFactor = easeFactor + 0.15;
      intervalDays =
        repetitions === 0 ? 4 : Math.max(1, Math.round(intervalDays * easeFactor * 1.3));
    } else {
      // GOOD
      if (repetitions === 0) intervalDays = 1;
      else if (repetitions === 1) intervalDays = 3;
      else intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
    }
    repetitions += 1;
    intervalDays = clamp(fuzz(intervalDays), 1, MAX_INTERVAL_DAYS);
  }

  const nextReviewDate = new Date(now);
  if (intervalDays === 0) {
    // Xato qilingan so'z shu sessiyada qayta chiqadi
    nextReviewDate.setMinutes(nextReviewDate.getMinutes() + 10);
  } else {
    nextReviewDate.setDate(nextReviewDate.getDate() + intervalDays);
    nextReviewDate.setHours(0, 0, 0, 0);
  }

  return {
    easeFactor: Number(easeFactor.toFixed(2)),
    intervalDays,
    repetitions,
    lapses,
    nextReviewDate,
    isLapse,
  };
};

/** Hisoblangan holatni mongoose hujjatiga yozish */
const applySchedule = (wordDoc, grade, now = new Date()) => {
  const next = schedule(wordDoc, grade, now);

  wordDoc.easeFactor = next.easeFactor;
  wordDoc.intervalDays = next.intervalDays;
  wordDoc.repetitions = next.repetitions;
  wordDoc.lapses = next.lapses;
  wordDoc.nextReviewDate = next.nextReviewDate;
  wordDoc.lastReviewedAt = now;

  // Eski maydonni ham yangilab boramiz (mavjud UI shunga qaraydi)
  wordDoc.reviewStage = next.repetitions;

  // `mastered` endi "o'chirish" emas, shunchaki yorliq: interval yarim yildan oshgan.
  // So'z baribir jadvalda qoladi va vaqti kelganda qaytadi.
  wordDoc.mastered = next.intervalDays >= 180;

  return next;
};

/** Foydalanuvchiga ko'rsatish uchun: har bir tugma qaysi intervalni beradi */
const previewIntervals = (word, now = new Date()) =>
  Object.fromEntries(
    Object.entries(GRADE).map(([name, value]) => [
      name.toLowerCase(),
      schedule(word, value, now).intervalDays,
    ])
  );

module.exports = {
  GRADE,
  MIN_EASE,
  DEFAULT_EASE,
  MAX_INTERVAL_DAYS,
  isValidGrade,
  gradeFromBoolean,
  schedule,
  applySchedule,
  previewIntervals,
  migrateLegacyState,
};
