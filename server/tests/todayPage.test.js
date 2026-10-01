const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, makeClient } = require('./helpers/testServer');
const { finishTopicDay, finishSpeakDay, reviewAllDue } = require('./helpers/dailyFlow');

/**
 * "Bugun" sahifasi uchun ma'lumot: hafta tasmasi va kechagi suhbat xatolari.
 */

test.before(async () => {
  await start();
});
test.after(async () => {
  await stop();
});

const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { buildWeek } = require('../utils/gamification');

const TODAY = '2026-10-08'; // payshanba

test("hafta tasmasi: bajarilgan, muzlatilgan, o'tkazilgan va ro'yxatdan oldingi kunlar", () => {
  const week = buildWeek(
    {
      timezone: 'Asia/Tashkent',
      createdAt: new Date('2026-10-03T08:00:00Z'),
      activity: { planDays: ['2026-10-04', '2026-10-06', '2026-10-07'], frozenDays: ['2026-10-05'] },
    },
    TODAY
  );
  assert.deepEqual(
    week.map((d) => d.status),
    // 02 (ro'yxatdan oldin), 03 (o'tkazildi), 04, 05 (muzlatildi), 06, 07, 08 (bugun)
    ['none', 'missed', 'done', 'frozen', 'done', 'done', 'today']
  );
  assert.equal(week[6].day, TODAY);
  assert.equal(week[6].weekday, 'Pa');
});

test("tarix yozilmagan eski foydalanuvchi: streak oynasidan taxmin qilinadi", () => {
  const week = buildWeek({ currentStreak: 3, lastStreakDay: '2026-10-07', activity: {} }, TODAY);
  assert.deepEqual(
    week.map((d) => d.status),
    ['missed', 'missed', 'missed', 'done', 'done', 'done', 'today']
  );
});

test('reja bajarilgach bugun tasmada "done" bo\'ladi', async () => {
  const api = makeClient();
  await api.register();
  const before = await api.get('/api/auth/me');
  assert.equal(before.data.week.length, 7);
  assert.equal(before.data.week[6].status, 'today');
  assert.equal(before.data.activity, undefined, 'xom tarix mijozga yuborilmaydi');

  await finishTopicDay(api);
  await finishSpeakDay(api);
  await reviewAllDue(api);

  const after = await api.get('/api/auth/me');
  assert.equal(after.data.week[6].status, 'done');
});

test('"Kechagi suhbatdan": oldingi kunning tuzatishlari, bugungisi emas', async () => {
  const api = makeClient();
  await api.register();
  const me = (await api.get('/api/auth/me')).data;

  const empty = await api.get('/api/speak/today');
  assert.equal(empty.data.recent, null);

  await Conversation.create({
    user: me._id,
    dayKey: '2000-01-01',
    contentDay: 1,
    status: 'completed',
    completedAt: new Date(Date.now() - 86400000),
    partner: { name: 'Sara', emoji: '👋' },
    topicUz: 'Tanishuv',
    feedback: {
      summaryUz: 'Yaxshi',
      corrections: [
        { said: 'I from Tashkent', better: 'I am from Tashkent', explanationUz: "'am' kerak" },
        { said: 'She have a cat', better: 'She has a cat', explanationUz: "'has'" },
        { said: 'x', better: 'y', explanationUz: 'z' },
      ],
    },
  });

  const res = await api.get('/api/speak/today');
  assert.equal(res.data.recent.partner.name, 'Sara');
  assert.equal(res.data.recent.corrections.length, 2, "ko'pi bilan 2 ta");
  assert.equal(res.data.recent.corrections[0].better, 'I am from Tashkent');

  // Boshqa foydalanuvchiga ko'rinmaydi
  const other = makeClient();
  await other.register();
  assert.equal((await other.get('/api/speak/today')).data.recent, null);
  await User.deleteOne({ _id: me._id });
});
