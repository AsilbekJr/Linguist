const test = require('node:test');
const assert = require('node:assert/strict');

const {
  GRADE,
  MIN_EASE,
  DEFAULT_EASE,
  schedule,
  applySchedule,
  gradeFromBoolean,
  isValidGrade,
  migrateLegacyState,
} = require('../utils/srs');

const NOW = new Date('2026-06-01T10:00:00Z');
const newWord = (over = {}) => ({
  easeFactor: DEFAULT_EASE,
  intervalDays: 0,
  repetitions: 0,
  lapses: 0,
  ...over,
});

test('yangi so\'z: GOOD → 1 kun', () => {
  const next = schedule(newWord(), GRADE.GOOD, NOW);
  assert.equal(next.intervalDays, 1);
  assert.equal(next.repetitions, 1);
  assert.equal(next.lapses, 0);
});

test('ikkinchi GOOD → 3 kun, keyingilari ease bilan ko\'payadi', () => {
  const second = schedule(newWord({ intervalDays: 1, repetitions: 1 }), GRADE.GOOD, NOW);
  assert.equal(second.intervalDays, 3);

  const third = schedule(newWord({ intervalDays: 3, repetitions: 2 }), GRADE.GOOD, NOW);
  // 3 * 2.5 = 7.5 → 8, ±5% fuzz
  assert.ok(third.intervalDays >= 7 && third.intervalDays <= 9, `kutilmagan: ${third.intervalDays}`);
});

test('AGAIN intervalni qayta boshlaydi va lapse hisoblaydi — eski kodda faqat -1 pog\'ona edi', () => {
  const mature = newWord({ intervalDays: 60, repetitions: 5, easeFactor: 2.5 });
  const next = schedule(mature, GRADE.AGAIN, NOW);

  assert.equal(next.repetitions, 0, 'takrorlashlar nolga tushishi kerak');
  assert.equal(next.intervalDays, 0, 'shu sessiyada qaytishi kerak');
  assert.equal(next.lapses, 1);
  assert.ok(next.easeFactor < 2.5, 'ease jazolanishi kerak');
  assert.equal(next.isLapse, true);
});

test('AGAIN → so\'z 10 daqiqada qaytadi, ertaga emas', () => {
  const next = schedule(newWord({ intervalDays: 10, repetitions: 3 }), GRADE.AGAIN, NOW);
  const diffMin = (next.nextReviewDate - NOW) / 60000;
  assert.ok(diffMin > 0 && diffMin <= 15, `kutilmagan: ${diffMin} daqiqa`);
});

test('ease MIN_EASE dan pastga tushmaydi', () => {
  let word = newWord({ easeFactor: 1.35, intervalDays: 5, repetitions: 2 });
  for (let i = 0; i < 10; i++) {
    const next = schedule(word, GRADE.AGAIN, NOW);
    word = { ...word, ...next };
  }
  assert.ok(word.easeFactor >= MIN_EASE, `ease ${word.easeFactor} < ${MIN_EASE}`);
});

test('HARD intervalni sekin oshiradi, EASY tez', () => {
  const base = newWord({ intervalDays: 10, repetitions: 3 });
  const hard = schedule(base, GRADE.HARD, NOW);
  const good = schedule(base, GRADE.GOOD, NOW);
  const easy = schedule(base, GRADE.EASY, NOW);

  assert.ok(hard.intervalDays < good.intervalDays, 'HARD < GOOD');
  assert.ok(good.intervalDays < easy.intervalDays, 'GOOD < EASY');
  assert.ok(hard.easeFactor < base.easeFactor, 'HARD ease pasaytiradi');
  assert.ok(easy.easeFactor > base.easeFactor, 'EASY ease oshiradi');
});

test('interval 365 kundan oshmaydi', () => {
  const veryMature = newWord({ intervalDays: 300, repetitions: 12, easeFactor: 3.0 });
  const next = schedule(veryMature, GRADE.EASY, NOW);
  assert.ok(next.intervalDays <= 365, `kutilmagan: ${next.intervalDays}`);
});

test('so\'z hech qachon takrorlashdan butunlay chiqmaydi', () => {
  // Eski kodda 5 ta to'g'ri javobdan keyin nextReviewDate = null bo'lib,
  // so'z abadiy yo'qolardi. Endi har doim sana bo'lishi kerak.
  let word = newWord();
  for (let i = 0; i < 12; i++) {
    const next = schedule(word, GRADE.EASY, NOW);
    assert.ok(next.nextReviewDate instanceof Date, `${i}-takrorlashda sana yo'q`);
    assert.ok(Number.isFinite(next.nextReviewDate.getTime()), 'sana yaroqsiz');
    word = { ...word, ...next };
  }
});

test('applySchedule hujjatni yangilaydi va mastered faqat yorliq bo\'ladi', () => {
  const doc = newWord({ intervalDays: 200, repetitions: 8 });
  applySchedule(doc, GRADE.GOOD, NOW);

  assert.ok(doc.mastered === true, '180+ kun → mastered yorlig\'i');
  assert.ok(doc.nextReviewDate instanceof Date, 'mastered bo\'lsa ham sana saqlanadi');
  assert.equal(doc.lastReviewedAt, NOW);
  assert.equal(doc.reviewStage, doc.repetitions);
});

test('eski reviewStage SM-2 holatiga to\'g\'ri ko\'chadi', () => {
  assert.equal(migrateLegacyState({ reviewStage: 0 }).intervalDays, 0);
  assert.equal(migrateLegacyState({ reviewStage: 3 }).intervalDays, 7);
  assert.equal(migrateLegacyState({ reviewStage: 5 }).intervalDays, 30);
  // chegaradan tashqari qiymat ham xavfsiz
  assert.ok(Number.isFinite(migrateLegacyState({ reviewStage: 99 }).intervalDays));
  assert.ok(Number.isFinite(migrateLegacyState({}).intervalDays));
});

test('binary → 4 darajali shkala', () => {
  assert.equal(gradeFromBoolean(true), GRADE.GOOD);
  assert.equal(gradeFromBoolean(false), GRADE.AGAIN);
  assert.equal(isValidGrade(0), true);
  assert.equal(isValidGrade(3), true);
  assert.equal(isValidGrade(4), false);
  assert.equal(isValidGrade('2'), false);
  assert.equal(isValidGrade(undefined), false);
});
