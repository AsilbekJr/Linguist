const test = require('node:test');
const assert = require('node:assert/strict');
const {
  LEVELS,
  QUESTIONS_PER_LEVEL,
  ITEMS,
  itemsByLevel,
  nextStep,
  cefrToLearnerLevel,
} = require('../content/placement');

/** Javoblar ketma-ketligini qurish uchun yordamchi */
const answer = (cefr, correct, times = 1) =>
  Array.from({ length: times }, () => ({ cefr, correct }));

test('savollar banki har bir daraja uchun yetarli', () => {
  for (const level of LEVELS) {
    assert.ok(
      itemsByLevel(level).length >= QUESTIONS_PER_LEVEL,
      `${level} da yetarli savol yo'q`
    );
  }
});

test('har bir savol yaroqli tuzilgan', () => {
  const ids = new Set();
  for (const item of ITEMS) {
    assert.ok(!ids.has(item.id), `takroriy id: ${item.id}`);
    ids.add(item.id);
    assert.ok(LEVELS.includes(item.cefr), `noma'lum daraja: ${item.cefr}`);
    assert.equal(item.options.length, 4, `${item.id}: 4 ta variant kerak`);
    assert.ok(
      Number.isInteger(item.correct) && item.correct >= 0 && item.correct < 4,
      `${item.id}: correct indeksi yaroqsiz`
    );
    assert.ok(item.prompt?.length > 5, `${item.id}: savol matni qisqa`);
    // Variantlar takrorlanmasin — aks holda ikkita to'g'ri javob bo'lib qoladi
    assert.equal(new Set(item.options).size, 4, `${item.id}: variantlar takrorlangan`);
  }
});

test('test A2 dan boshlanadi', () => {
  const step = nextStep([]);
  assert.equal(step.done, false);
  assert.equal(step.nextLevel, 'A2');
});

test('daraja tugamaguncha savol beriladi', () => {
  assert.equal(nextStep(answer('A2', true, 1)).nextLevel, 'A2');
  assert.equal(nextStep(answer('A2', true, 2)).nextLevel, 'A2');
  assert.equal(nextStep(answer('A2', true, 2)).done, false);
});

test("A2 dan o'tsa B1 ga ko'tariladi", () => {
  const step = nextStep([...answer('A2', true, 2), ...answer('A2', false, 1)]);
  assert.equal(step.done, false);
  assert.equal(step.nextLevel, 'B1');
});

test("A2 dan yiqilsa A1 ga tushadi", () => {
  const step = nextStep([...answer('A2', true, 1), ...answer('A2', false, 2)]);
  assert.equal(step.done, false);
  assert.equal(step.nextLevel, 'A1');
});

test("A1 dan ham yiqilsa natija A1 (pastki chegara)", () => {
  const answers = [...answer('A2', false, 3), ...answer('A1', false, 3)];
  const step = nextStep(answers);
  assert.equal(step.done, true);
  assert.equal(step.level, 'A1');
});

test("A1 dan o'tsa natija A1", () => {
  const answers = [...answer('A2', false, 3), ...answer('A1', true, 3)];
  const step = nextStep(answers);
  assert.equal(step.done, true);
  assert.equal(step.level, 'A1');
});

test("B1 dan o'tsa B2 sinaladi", () => {
  const answers = [...answer('A2', true, 3), ...answer('B1', true, 3)];
  const step = nextStep(answers);
  assert.equal(step.done, false);
  assert.equal(step.nextLevel, 'B2');
});

test("B1 dan yiqilsa natija A2 (o'tgan eng yuqori daraja)", () => {
  const answers = [...answer('A2', true, 3), ...answer('B1', false, 3)];
  const step = nextStep(answers);
  assert.equal(step.done, true);
  assert.equal(step.level, 'A2');
});

test("B2 dan o'tsa natija B2 — yuqori daraja yo'q, test tugaydi", () => {
  const answers = [
    ...answer('A2', true, 3),
    ...answer('B1', true, 3),
    ...answer('B2', true, 3),
  ];
  const step = nextStep(answers);
  assert.equal(step.done, true);
  assert.equal(step.level, 'B2');
});

test("B2 dan yiqilsa natija B1", () => {
  const answers = [
    ...answer('A2', true, 3),
    ...answer('B1', true, 3),
    ...answer('B2', false, 3),
  ];
  const step = nextStep(answers);
  assert.equal(step.done, true);
  assert.equal(step.level, 'B1');
});

test("test hech qachon 12 savoldan oshmaydi", () => {
  // Har qanday javob ketma-ketligida test yakunlanishi kerak
  const paths = [
    () => true,
    () => false,
    (() => {
      let n = 0;
      return () => n++ % 2 === 0;
    })(),
    (() => {
      let n = 0;
      return () => n++ % 3 !== 0;
    })(),
  ];

  for (const decide of paths) {
    const answers = [];
    let step = nextStep(answers);
    let guard = 0;
    while (!step.done) {
      answers.push({ cefr: step.nextLevel, correct: decide() });
      step = nextStep(answers);
      guard++;
      assert.ok(guard <= 20, 'test tugamadi — cheksiz sikl');
    }
    assert.ok(answers.length <= 12, `juda ko'p savol: ${answers.length}`);
    assert.ok(LEVELS.includes(step.level), `yaroqsiz natija: ${step.level}`);
  }
});

test('CEFR ilovadagi darajaga to\'g\'ri o\'giriladi', () => {
  assert.equal(cefrToLearnerLevel('A1'), 'beginner');
  assert.equal(cefrToLearnerLevel('A2'), 'beginner');
  assert.equal(cefrToLearnerLevel('B1'), 'intermediate');
  assert.equal(cefrToLearnerLevel('B2'), 'advanced');
  assert.equal(cefrToLearnerLevel(undefined), 'beginner');
});
