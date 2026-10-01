import test from 'node:test';
import assert from 'node:assert/strict';

import { getDailyPlan } from '../src/utils/dailyPlan.js';

const day = '2026-10-01';
const user = (quests) => ({ today: day, dailyQuests: { date: day, ...quests } });

test("yangi foydalanuvchi (navbat bo'sh) 0/2 ko'radi — o'tkazilgan takrorlash sanalmaydi", () => {
  const plan = getDailyPlan(user({ reviewCompleted: true, reviewSkipped: true }));
  assert.equal(plan.total, 2);
  assert.equal(plan.done, 0);
  assert.equal(plan.reviewDone, false);
  assert.equal(plan.allDone, false);
});

test("navbat bo'sh kunda sahna va suhbat tugasa reja to'liq", () => {
  const plan = getDailyPlan(
    user({ topicCompleted: true, speakCompleted: true, reviewCompleted: true, reviewSkipped: true })
  );
  assert.deepEqual([plan.done, plan.total, plan.allDone], [2, 2, true]);
});

test('oddiy kun: Sahna → Suhbat → Takrorlash', () => {
  const empty = getDailyPlan(user({}));
  assert.deepEqual([empty.done, empty.total], [0, 3]);
  assert.deepEqual(empty.steps.map((s) => s.key), ['topic', 'speak', 'review']);
  const partial = getDailyPlan(user({ topicCompleted: true, reviewCompleted: true }));
  assert.deepEqual([partial.done, partial.total, partial.allDone, partial.speakDone], [2, 3, false, false]);
});

test('kechagi belgilar bugun hisoblanmaydi', () => {
  const plan = getDailyPlan({
    today: day,
    dailyQuests: { date: '2026-09-30', topicCompleted: true, speakCompleted: true, reviewCompleted: true },
  });
  assert.deepEqual([plan.done, plan.total], [0, 3]);
});
