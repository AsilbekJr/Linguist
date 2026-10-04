const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWeek, completeDailyStep } = require('../utils/gamification');
test('finishing a scene marks activity without claiming a complete daily plan', () => {
  const user = { timezone: 'Asia/Tashkent', activity: {}, dailyQuests: {}, xp: 0 };
  completeDailyStep(user, 'topic', '2026-10-03');
  assert.equal(buildWeek(user, '2026-10-03')[6].status, 'active');
  assert.equal(user.currentStreak || 0, 0);
  assert.equal(buildWeek(user, '2026-10-04')[5].status, 'active');
});
test('review activity remains visible after daily quests roll to tomorrow', async () => {
  const { start, stop, makeClient } = require('./helpers/testServer');
  await start();
  try {
    const api = makeClient();
    const me = (await api.register()).data;
    const Word = require('../models/Word');
    const User = require('../models/User');
    const word = await Word.create({ user: me._id, word: 'apple', translation: 'olma', examples: ['I eat an apple.'], stage: 0 });
    const result = await api.post(`/api/review/${word._id}/check`, { mode: 'recognize', answer: 'olma' });
    assert.equal(result.status, 200);
    const { userDayKey, shiftDayKey } = require('../utils/dayKey');
    const today = userDayKey(me);
    assert.equal((await api.get('/api/topics/current')).data.dayKey, today);
    await User.updateOne({ _id: me._id }, { $set: { dailyQuests: { date: shiftDayKey(today, 1) } } });
    const after = await User.findById(me._id);
    assert.equal(buildWeek(after, shiftDayKey(today, 1))[5].status, 'active');
    assert.equal(after.currentStreak, 0);
  } finally { await stop(); }
});
