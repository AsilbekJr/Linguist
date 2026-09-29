const { dayKey, shiftDayKey, startOfDay } = require('./dayKey');

/**
 * Oraliqli takrorlash — 7 bosqichli model.
 *
 * Bosqichlar va intervallar:
 *   1 → 1 kun    4 → 7 kun     7 → 60 kun
 *   2 → 2 kun    5 → 14 kun
 *   3 → 4 kun    6 → 30 kun
 *
 * 7-bosqichdagi so'z muvaffaqiyatli takrorlansa YODLANGAN deb belgilanadi va
 * navbatdan chiqadi (`nextReviewDate = null`). Uni lug'atdan qo'lda qaytarish
 * mumkin — o'shanda o'rtadagi 4-bosqichdan (7 kun) boshlanadi, noldan emas:
 * bir marta yodlangan so'zni yana 1 kunlik intervaldan boshlash mashqni
 * bekorga cho'zardi.
 *
 * Xato qilinsa bosqich 1 ga qaytadi. Bu SM-2 mantiqi: unutilgan so'z uchun
 * "bitta pog'ona pastga" yetarli emas, chunki oraliq baribir uzun qoladi va
 * so'z ikkinchi marta ham unutiladi.
 *
 * Nega SM-2 emas:
 * Ilgari bu yerda ease factor bilan ishlaydigan SM-2 bor edi va u foydalanuvchining
 * 4 darajali o'z-o'zini baholashiga tayanardi ("Qiyin" / "Esladim" / …). Endi
 * takrorlash gap tuzish orqali o'tadi va natija ikkilik: gap to'g'ri yoki xato.
 * Ease factor uchun kirish signali qolmadi, shuning uchun qat'iy bosqichlar
 * ishlatiladi. Eski maydonlar (`easeFactor`, `repetitions`) sxemada qoladi —
 * mavjud hujjatlar migratsiya qilinadi, quyiga qarang.
 */

/**
 * Bosqich → keyingi takrorlashgacha necha kun. Indeks 0 ishlatilmaydi.
 *
 * Diqqat: 7-bosqichning 60 kuni HECH QACHON kutilmaydi. So'z 7-bosqichga
 * yetishi bilanoq yodlangan bo'ladi va navbatdan chiqadi — ya'ni 7 ta
 * muvaffaqiyatli takrorlash yetarli. 60 faqat ko'rsatish uchun saqlanadi
 * (so'z qaytarilsa qaysi tartibda davom etishini tushuntirish oson bo'lsin).
 */
const STAGE_INTERVALS = [0, 1, 2, 4, 7, 14, 30, 60];

/** Shu bosqichga yetgan so'z yodlangan hisoblanadi */
const MAX_STAGE = STAGE_INTERVALS.length - 1; // 7

/** Yodlangan so'z qayta yodlashga o'tkazilsa shu bosqichdan boshlanadi */
const RELEARN_STAGE = 4;

/** Xato qilinganda qaytiladigan bosqich */
const RESET_STAGE = 1;

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * `days` kundan keyingi kunning FOYDALANUVCHI zonasidagi yarim tuni.
 *
 * Ilgari `setHours(0, 0, 0, 0)` ishlatilardi — bu SERVER zonasi (Render'da UTC).
 * Toshkent uchun UTC yarim tuni mahalliy 05:00, ya'ni so'z yarim tunda emas,
 * ertalab beshda navbatga tushardi va kunlik reja chegarasi bilan mos kelmasdi.
 */
const dueDateAfter = (now, days, tz) =>
  startOfDay(shiftDayKey(dayKey(now, tz), days), tz);

/**
 * Intervalga ±5% tasodifiy og'ish.
 *
 * Busiz bir kunda qo'shilgan 20 ta so'z 30 kundan keyin ham aynan bir kunda
 * qaytadi va foydalanuvchi devorga uriladi. Qisqa intervallarda qo'llanmaydi:
 * 2 kunlik interval 1 kunga tushsa, o'rganish bosqichi buziladi.
 */
const fuzz = (days) => {
  if (days < 7) return days;
  const spread = Math.round(days * 0.05);
  if (spread < 1) return days;
  return days + Math.floor(Math.random() * (spread * 2 + 1)) - spread;
};

/**
 * Hujjatdan joriy bosqichni o'qish.
 *
 * `stage` yo'q bo'lsa — bu eski hujjat. Uni SM-2 davridagi `repetitions`
 * (yoki undan ham eski `reviewStage`) asosida tiklaymiz, shunda mavjud
 * foydalanuvchilar progressi yo'qolmaydi.
 */
const readStage = (word) => {
  if (word.stage != null) return clamp(Number(word.stage) || 0, 0, MAX_STAGE);
  const legacy = Number(word.repetitions ?? word.reviewStage) || 0;
  return clamp(legacy, 0, MAX_STAGE);
};

/**
 * Keyingi holatni hisoblaydi. Sof funksiya.
 *
 * @param {object} word          so'z hujjati (yoki oddiy obyekt)
 * @param {boolean} isCorrect    gap to'g'ri tuzilganmi
 * @param {Date} [now]
 * @param {string} [tz]         foydalanuvchi zonasi (IANA); yo'q bo'lsa DEFAULT_TIMEZONE
 * @returns {{stage, intervalDays, lapses, nextReviewDate, learned, isLapse}}
 */
const schedule = (word, isCorrect, now = new Date(), tz) => {
  const currentStage = readStage(word);
  let lapses = Number(word.lapses) || 0;
  let stage;
  let isLapse = false;

  if (isCorrect) {
    stage = clamp(currentStage + 1, 1, MAX_STAGE);
  } else {
    isLapse = true;
    lapses += 1;
    stage = RESET_STAGE;
  }

  // 7-bosqichga yetdi — so'z yodlandi va navbatdan chiqadi.
  // Ya'ni 7 ta muvaffaqiyatli takrorlash yetarli, 8-tasi kutilmaydi.
  if (stage >= MAX_STAGE) {
    return {
      stage: MAX_STAGE,
      intervalDays: STAGE_INTERVALS[MAX_STAGE],
      lapses,
      nextReviewDate: null,
      learned: true,
      isLapse: false,
    };
  }

  const intervalDays = fuzz(STAGE_INTERVALS[stage]);
  const nextReviewDate = dueDateAfter(now, intervalDays, tz);

  return { stage, intervalDays, lapses, nextReviewDate, learned: false, isLapse };
};

/** Hisoblangan holatni mongoose hujjatiga yozish */
const applySchedule = (wordDoc, isCorrect, now = new Date(), tz) => {
  const next = schedule(wordDoc, isCorrect, now, tz);

  wordDoc.stage = next.stage;
  wordDoc.intervalDays = next.intervalDays;
  wordDoc.lapses = next.lapses;
  wordDoc.nextReviewDate = next.nextReviewDate;
  wordDoc.lastReviewedAt = now;
  wordDoc.learned = next.learned;
  if (next.learned && !wordDoc.learnedAt) wordDoc.learnedAt = now;
  if (!next.learned) wordDoc.learnedAt = null;

  // Eski maydonlar — mavjud hujjatlar bilan izchillik uchun yangilab boriladi
  wordDoc.repetitions = next.stage;
  wordDoc.reviewStage = next.stage;
  wordDoc.mastered = next.learned;

  return next;
};

/**
 * Yodlangan so'zni qayta yodlashga qaytaradi.
 *
 * O'rtadagi bosqichdan (4 → 7 kun) boshlanadi: so'z bir marta yodlangan,
 * shuning uchun uni yangi so'z kabi 1 kundan boshlash keraksiz takrorlash
 * bo'lardi.
 */
const restartLearning = (wordDoc, now = new Date(), tz) => {
  const intervalDays = STAGE_INTERVALS[RELEARN_STAGE];
  const nextReviewDate = dueDateAfter(now, intervalDays, tz);

  wordDoc.stage = RELEARN_STAGE;
  wordDoc.intervalDays = intervalDays;
  wordDoc.nextReviewDate = nextReviewDate;
  wordDoc.learned = false;
  wordDoc.learnedAt = null;
  wordDoc.repetitions = RELEARN_STAGE;
  wordDoc.reviewStage = RELEARN_STAGE;
  wordDoc.mastered = false;

  return { stage: RELEARN_STAGE, intervalDays, nextReviewDate, learned: false };
};

/** Yangi qo'shilgan so'zning boshlang'ich holati */
const initialState = (now = new Date()) => ({
  stage: 0,
  intervalDays: 0,
  lapses: 0,
  learned: false,
  nextReviewDate: now,
});

/** UI uchun: bosqich → nechanchi kundan keyin qaytadi */
const stageInterval = (stage) => STAGE_INTERVALS[clamp(Number(stage) || 0, 0, MAX_STAGE)];

module.exports = {
  dueDateAfter,
  STAGE_INTERVALS,
  MAX_STAGE,
  RELEARN_STAGE,
  RESET_STAGE,
  readStage,
  schedule,
  applySchedule,
  restartLearning,
  initialState,
  stageInterval,
};
