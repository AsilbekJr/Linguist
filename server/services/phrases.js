const Phrase = require('../models/Phrase');
const { dueDateAfter } = require('../utils/srs');

/**
 * Ibora kartalari: yaratish, navbat va jadval.
 *
 * Jadval so'znikidan qisqa — ibora sahnada allaqachon 2-4 marta ovoz
 * chiqarib aytilgan: ertaga → 3 kun → 1 hafta → 2 hafta → 1 oy → yodlangan.
 */
const INTERVALS = [1, 3, 7, 14, 30];
const LEARNED_STAGE = INTERVALS.length;
/** Bir kunda ko'pi bilan — "kuniga 15 daqiqa" saqlansin */
const DAILY_PHRASE_LIMIT = 5;
/** Aytilgan gap shuncha foiz mos kelsa — to'g'ri */
const PASS_PERCENT = 80;

const phraseKey = (text) => String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');

const dueFilter = (userId, now) => ({ user: userId, learned: { $ne: true }, nextReviewDate: { $lte: now } });

/**
 * Sahna yakunlanganda: kalit gaplar ertangi takrorlashga qo'shiladi.
 * Avval qo'shilgan ibora qayta yaratilmaydi va jadvali buzilmaydi.
 */
const addScenePhrases = async (user, keyLines, contentDay, now = new Date()) => {
  if (!keyLines?.length) return 0;
  const nextReviewDate = dueDateAfter(now, 1, user.timezone);
  const ops = keyLines.map((l) => ({
    updateOne: {
      filter: { user: user._id, key: phraseKey(l.en) },
      update: {
        $setOnInsert: {
          user: user._id,
          key: phraseKey(l.en),
          text: l.en,
          textUz: l.uz || '',
          contentDay,
          nextReviewDate,
        },
      },
      upsert: true,
    },
  }));
  const res = await Phrase.bulkWrite(ops, { ordered: false });
  return res.upsertedCount || 0;
};

const countDue = (userId, now = new Date()) => Phrase.countDocuments(dueFilter(userId, now));

const listDue = (userId, now = new Date()) =>
  Phrase.find(dueFilter(userId, now)).sort({ nextReviewDate: 1, lapses: -1 }).limit(DAILY_PHRASE_LIMIT).lean();

/** Javob oshkor qilinmaydi: faqat ma'nosi va birinchi harflar (so'rasa ko'rsatiladi) */
const presentPhrase = (p) => ({
  _id: p._id,
  kind: 'phrase',
  textUz: p.textUz,
  hint: p.text
    .split(/\s+/)
    .map((w) => {
      const m = w.match(/^([^A-Za-z0-9']*)([A-Za-z0-9'-]*)(.*)$/);
      if (!m || m[2].length <= 1) return w;
      return `${m[1]}${m[2][0]}${'_'.repeat(Math.min(m[2].length - 1, 9))}${m[3]}`;
    })
    .join(' '),
  wordCount: p.text.split(/\s+/).length,
  stage: p.stage,
  maxStage: LEARNED_STAGE,
});

const applyPhraseSchedule = (doc, isCorrect, now, tz) => {
  if (isCorrect) {
    doc.stage = Math.min(doc.stage + 1, LEARNED_STAGE);
  } else {
    doc.stage = Math.max(0, doc.stage - 1);
    doc.lapses += 1;
  }
  doc.lastReviewedAt = now;
  doc.learned = doc.stage >= LEARNED_STAGE;
  // Xato — ertaga qaytadi; to'g'ri — keyingi interval
  const days = isCorrect ? INTERVALS[Math.min(doc.stage, INTERVALS.length) - 1] || 1 : 1;
  doc.nextReviewDate = dueDateAfter(now, days, tz);
  return { stage: doc.stage, learned: doc.learned, nextReviewDate: doc.nextReviewDate, intervalDays: days };
};

module.exports = {
  addScenePhrases,
  countDue,
  listDue,
  presentPhrase,
  applyPhraseSchedule,
  phraseKey,
  PASS_PERCENT,
  DAILY_PHRASE_LIMIT,
  LEARNED_STAGE,
};
