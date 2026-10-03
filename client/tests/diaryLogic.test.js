import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isStoryDue,
  daysUntilNextStory,
  pickComparison,
  dayLabel,
  entriesToPrune,
  daysBetween,
  PHRASE_KEEP,
} from '../src/utils/diaryLogic.js';

const story = (dayKey, id = dayKey) => ({ id, kind: 'story', dayKey, createdAt: 0 });
const phrase = (dayKey, id) => ({ id, kind: 'phrase', dayKey, createdAt: 0 });

test("kunlar orasidagi farq oy va yil chegarasidan to'g'ri o'tadi", () => {
  assert.equal(daysBetween('2026-09-28', '2026-10-05'), 7);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
});

test('hikoya: birinchisi darhol, keyingisi 7 kundan keyin', () => {
  assert.equal(isStoryDue([], '2026-10-01'), true);
  const entries = [story('2026-10-01')];
  assert.equal(isStoryDue(entries, '2026-10-07'), false);
  assert.equal(daysUntilNextStory(entries, '2026-10-07'), 1);
  assert.equal(isStoryDue(entries, '2026-10-08'), true);
  // Iboralar hikoya muddatiga ta'sir qilmaydi
  assert.equal(isStoryDue([phrase('2026-10-01', 'p1')], '2026-10-01'), true);
});

test('"1-kun va bugun": birinchi va oxirgi hikoya', () => {
  assert.equal(pickComparison([story('2026-10-01')]), null);
  const cmp = pickComparison([story('2026-10-15'), story('2026-10-01'), story('2026-10-08')]);
  assert.equal(cmp.first.dayKey, '2026-10-01');
  assert.equal(cmp.last.dayKey, '2026-10-15');
  assert.equal(cmp.days, 14);
});

test('kun yorlig\'i kundalik boshlangan kundan sanaladi', () => {
  const entries = [phrase('2026-10-03', 'a'), story('2026-10-01')];
  assert.equal(dayLabel(entries, '2026-10-01'), '1-kun');
  assert.equal(dayLabel(entries, '2026-10-30'), '30-kun');
});

test("eski iboralar o'chiriladi, hikoyalar hech qachon", () => {
  const entries = [story('2026-01-01')];
  for (let i = 0; i < PHRASE_KEEP + 3; i++) {
    entries.push(phrase(`2026-02-${String((i % 28) + 1).padStart(2, '0')}`, `p${i}`));
  }
  const prune = entriesToPrune(entries);
  assert.equal(prune.length, 3);
  assert.ok(!prune.includes('2026-01-01'));
});
