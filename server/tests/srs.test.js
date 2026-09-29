const test = require('node:test');
const assert = require('node:assert/strict');

const {
  STAGE_INTERVALS,
  MAX_STAGE,
  RELEARN_STAGE,
  readStage,
  schedule,
  applySchedule,
  restartLearning,
  initialState,
  stageInterval,
} = require('../utils/srs');

const { dayKey, daysBetween } = require('../utils/dayKey');

/**
 * nextReviewDate FOYDALANUVCHI zonasidagi yarim tunga to'g'rilanadi. Kalendar
 * kunlari aniq zonada solishtiriladi — test mashinaning mahalliy vaqtiga
 * bog'liq bo'lmasligi kerak (CI odatda UTC'da ishlaydi).
 */
const TZ = 'Asia/Tashkent';
const calendarDaysBetween = (later, earlier, tz = TZ) =>
  daysBetween(dayKey(earlier, tz), dayKey(later, tz));

// ─── Bosqichlar jadvali ──────────────────────────────────────────────────────

test('7 bosqich va ularning intervallari', () => {
  assert.equal(MAX_STAGE, 7);
  assert.deepEqual(STAGE_INTERVALS.slice(1), [1, 2, 4, 7, 14, 30, 60]);
  assert.equal(stageInterval(1), 1);
  assert.equal(stageInterval(4), 7);
  assert.equal(stageInterval(7), 60);
});

test('to\'g\'ri javob bosqichni bittaga oshiradi', () => {
  const now = new Date('2026-01-01T10:00:00Z');
  let word = { stage: 0 };

  for (const expected of [1, 2, 3, 4, 5, 6]) {
    const next = schedule(word, true, now);
    assert.equal(next.stage, expected);
    assert.equal(next.learned, false);
    word = { stage: next.stage };
  }
});

test('7-chi to\'g\'ri takrorlash so\'zni yodlangan qiladi (8-chi emas)', () => {
  let word = { stage: 0 };
  for (let i = 1; i <= 6; i++) {
    const next = schedule(word, true);
    assert.equal(next.learned, false, `${i}-takrorlashda hali yodlanmagan`);
    word = { stage: next.stage };
  }
  const seventh = schedule(word, true);
  assert.equal(seventh.learned, true, '7-takrorlash → yodlangan');
});

test('interval bosqichga mos kun beradi', () => {
  const now = new Date('2026-01-01T10:00:00Z');
  // Qisqa intervallarda fuzz qo'llanmaydi — aniq solishtirish mumkin
  assert.equal(schedule({ stage: 0 }, true, now).intervalDays, 1);
  assert.equal(schedule({ stage: 1 }, true, now).intervalDays, 2);
  assert.equal(schedule({ stage: 2 }, true, now).intervalDays, 4);
});

test('uzun intervallarda ±5% fuzz qo\'llanadi, lekin chegaradan chiqmaydi', () => {
  const now = new Date('2026-01-01T10:00:00Z');
  // 6-bosqich → 30 kun ±5% (28..32)
  for (let i = 0; i < 40; i++) {
    const d = schedule({ stage: 5 }, true, now).intervalDays;
    assert.ok(d >= 28 && d <= 32, `30 kun atrofida bo'lishi kerak, keldi: ${d}`);
  }
});

test('nextReviewDate intervalga mos va yarim tunga to\'g\'rilangan', () => {
  const now = new Date('2026-01-01T10:00:00Z');
  const next = schedule({ stage: 0 }, true, now, TZ);
  assert.equal(calendarDaysBetween(next.nextReviewDate, now), 1);
  // Toshkent yarim tuni = 19:00 UTC oldingi kun (server UTC'da bo'lsa ham)
  assert.equal(next.nextReviewDate.toISOString(), '2026-01-01T19:00:00.000Z');
});

test("nextReviewDate foydalanuvchi zonasiga bog'liq, server zonasiga emas", () => {
  // Toshkentda allaqachon 2-yanvar (00:30), UTC'da hali 1-yanvar
  const now = new Date('2026-01-01T19:30:00Z');
  const tashkent = schedule({ stage: 0 }, true, now, 'Asia/Tashkent');
  assert.equal(tashkent.nextReviewDate.toISOString(), '2026-01-02T19:00:00.000Z');

  const newYork = schedule({ stage: 0 }, true, now, 'America/New_York');
  assert.equal(newYork.nextReviewDate.toISOString(), '2026-01-02T05:00:00.000Z');
});

// ─── Xato ────────────────────────────────────────────────────────────────────

test('xato javob bosqichni 1 ga qaytaradi (bir pog\'ona emas)', () => {
  // Bir pog'ona pastga tushirish yetarli emas: 6-bosqichdan 5-ga tushgan so'z
  // baribir 14 kundan keyin qaytardi va ikkinchi marta ham unutilardi.
  const next = schedule({ stage: 6, lapses: 0 }, false);
  assert.equal(next.stage, 1);
  assert.equal(next.intervalDays, 1);
  assert.equal(next.isLapse, true);
  assert.equal(next.lapses, 1);
});

test('lapses to\'planib boradi', () => {
  assert.equal(schedule({ stage: 3, lapses: 2 }, false).lapses, 3);
});

// ─── Yodlangan holat ─────────────────────────────────────────────────────────

test('7-bosqichdan o\'tgan so\'z yodlangan bo\'ladi va navbatdan chiqadi', () => {
  const next = schedule({ stage: MAX_STAGE }, true);
  assert.equal(next.learned, true);
  assert.equal(next.nextReviewDate, null, 'navbatga tushmasligi uchun null');
  assert.equal(next.stage, MAX_STAGE);
});

test('applySchedule hujjatga yodlangan holatni yozadi', () => {
  const doc = { stage: MAX_STAGE };
  const next = applySchedule(doc, true);

  assert.equal(doc.learned, true);
  assert.ok(doc.learnedAt instanceof Date);
  assert.equal(doc.nextReviewDate, null);
  // Eski maydonlar sinxron yuritiladi — mavjud mijozlar buzilmasin
  assert.equal(doc.mastered, true);
  assert.equal(doc.reviewStage, MAX_STAGE);
  assert.equal(next.learned, true);
});

test('yodlangan so\'z xato javobdan keyin qayta o\'rganishga tushadi', () => {
  const doc = { stage: MAX_STAGE, learned: true, learnedAt: new Date() };
  applySchedule(doc, false);
  assert.equal(doc.learned, false);
  assert.equal(doc.learnedAt, null);
  assert.equal(doc.stage, 1);
});

test('restartLearning o\'rtadagi 4-bosqichdan boshlaydi', () => {
  // Bir marta yodlangan so'zni yangi so'z kabi 1 kundan boshlash
  // keraksiz takrorlash bo'lardi
  const doc = { stage: MAX_STAGE, learned: true, learnedAt: new Date() };
  const next = restartLearning(doc);

  assert.equal(next.stage, RELEARN_STAGE);
  assert.equal(RELEARN_STAGE, 4);
  assert.equal(next.intervalDays, 7);
  assert.equal(doc.learned, false);
  assert.equal(doc.learnedAt, null);
  assert.equal(doc.mastered, false);
});

// ─── Migratsiya ──────────────────────────────────────────────────────────────

test('eski hujjatlar SM-2 maydonlaridan bosqichga ko\'chadi', () => {
  // `stage` yo'q — bu SM-2 davridagi hujjat
  assert.equal(readStage({ repetitions: 3 }), 3);
  assert.equal(readStage({ reviewStage: 5 }), 5);
  assert.equal(readStage({}), 0);
  // Chegaradan oshgan qiymat qisiladi
  assert.equal(readStage({ repetitions: 99 }), MAX_STAGE);
  assert.equal(readStage({ repetitions: -4 }), 0);
});

test('stage mavjud bo\'lsa eski maydonlar e\'tiborga olinmaydi', () => {
  assert.equal(readStage({ stage: 2, repetitions: 6 }), 2);
});

test('initialState yangi so\'zni bugun navbatga qo\'yadi', () => {
  const now = new Date('2026-01-01T10:00:00Z');
  const s = initialState(now);
  assert.equal(s.stage, 0);
  assert.equal(s.learned, false);
  assert.equal(s.lapses, 0);
  assert.equal(s.nextReviewDate, now);
});
