import test from 'node:test';
import assert from 'node:assert/strict';

import { getDailyPlan } from '../src/utils/dailyPlan.js';

const day = '2026-10-01';
const user = (quests) => ({ today: day, dailyQuests: { date: day, ...quests } });

test("yangi foydalanuvchi (navbat bo'sh) 0/1 ko'radi, 1/2 emas", () => {
  const plan = getDailyPlan(user({ reviewCompleted: true, reviewSkipped: true }));
  assert.equal(plan.total, 1);
  assert.equal(plan.done, 0);
  assert.equal(plan.reviewDone, false);
  assert.equal(plan.allDone, false);
});

test("navbat bo'sh kunda sahna tugasa reja to'liq", () => {
  const plan = getDailyPlan(user({ topicCompleted: true, reviewCompleted: true, reviewSkipped: true }));
  assert.deepEqual([plan.done, plan.total, plan.allDone], [1, 1, true]);
});

test('oddiy kun: ikki qadam', () => {
  assert.deepEqual(
    [getDailyPlan(user({})).done, getDailyPlan(user({})).total],
    [0, 2]
  );
  const half = getDailyPlan(user({ reviewCompleted: true }));
  assert.deepEqual([half.done, half.total, half.reviewDone], [1, 2, true]);
});

test('kechagi belgilar bugun hisoblanmaydi', () => {
  const plan = getDailyPlan({ today: day, dailyQuests: { date: '2026-09-30', topicCompleted: true, reviewCompleted: true } });
  assert.deepEqual([plan.done, plan.total], [0, 2]);
});
