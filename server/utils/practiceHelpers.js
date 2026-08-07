const { startOfUserDay } = require('./dayKey');

/**
 * So'zlarni "bugun / kecha / avvalgi" guruhlariga ajratadi.
 * Chegara foydalanuvchi vaqt zonasidagi yarim tundan olinadi — ilgari server
 * mahalliy vaqti ishlatilgani uchun Render'dagi UTC server O'zbekistondagi
 * foydalanuvchining kunini 5 soatga siljitardi.
 */
const bucketWordsByDay = (words, user) => {
  const todayStart = startOfUserDay(user);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const buckets = {
    today: [],
    yesterday: [],
    older: [],
  };

  const seen = new Set();
  for (const w of words) {
    const id = String(w._id);
    if (seen.has(id)) continue;
    seen.add(id);

    const created = new Date(w.createdAt || Date.now());
    if (created >= todayStart) buckets.today.push(w);
    else if (created >= yesterdayStart) buckets.yesterday.push(w);
    else buckets.older.push(w);
  }

  return buckets;
};

const pickFromBucket = (arr, count) => {
  if (!arr?.length) return [];
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

const buildPracticeRounds = (buckets) => {
  const rounds = [];

  const todayPick = pickFromBucket(buckets.today, 2);
  if (todayPick.length) {
    rounds.push({
      bucket: 'today',
      bucketLabel: "Bugun o'rganilgan",
      words: todayPick,
    });
  }

  const yesterdayPick = pickFromBucket(buckets.yesterday, 2);
  if (yesterdayPick.length) {
    rounds.push({
      bucket: 'yesterday',
      bucketLabel: "Kecha o'rganilgan",
      words: yesterdayPick,
    });
  }

  const olderPick = pickFromBucket(buckets.older, 2);
  if (olderPick.length) {
    rounds.push({
      bucket: 'older',
      bucketLabel: 'Avvalgi kunlar',
      words: olderPick,
    });
  }

  if (rounds.length === 0) {
    const fallback = pickFromBucket(
      [...buckets.today, ...buckets.yesterday, ...buckets.older],
      3
    );
    if (fallback.length) {
      rounds.push({
        bucket: 'mixed',
        bucketLabel: "Yodlangan so'zlar",
        words: fallback,
      });
    }
  }

  return rounds.slice(0, 3);
};

const formatWordForClient = (w) => ({
  _id: w._id,
  word: w.word,
  translation: w.translation,
  definition: w.definition,
  reviewStage: w.reviewStage,
  createdAt: w.createdAt,
});

module.exports = {
  bucketWordsByDay,
  buildPracticeRounds,
  formatWordForClient,
};
