process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
process.env.TELEGRAM_BOT_USERNAME = 'linguist_test_bot';
process.env.TELEGRAM_WEBHOOK_SECRET = 'test-webhook-secret-value';

const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, makeClient } = require('./helpers/testServer');
const { _setTransport } = require('../services/telegramService');
const { runReminders } = require('../services/reminderRunner');
const User = require('../models/User');

/**
 * Bot API o'rniga yozib boruvchi soxta transport.
 * `blockChats` dagi chatlarga yuborish 403 qaytaradi (bot bloklangan).
 */
const sent = [];
const blockChats = new Set();
_setTransport(async (url, init) => {
  const method = url.split('/').pop();
  const body = JSON.parse(init.body);
  sent.push({ method, body });
  if (method === 'sendMessage' && blockChats.has(String(body.chat_id))) {
    return { status: 403, json: async () => ({ ok: false, description: 'Forbidden: bot was blocked by the user' }) };
  }
  return { status: 200, json: async () => ({ ok: true, result: {} }) };
});

const lastMessageTo = (chatId) =>
  [...sent].reverse().find((m) => m.method === 'sendMessage' && String(m.body.chat_id) === String(chatId));

const webhook = (api, update, secret = process.env.TELEGRAM_WEBHOOK_SECRET) =>
  fetch(`${api.baseUrl}/api/telegram/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': secret },
    body: JSON.stringify(update),
  });

const startUpdate = (chatId, text) => ({
  update_id: Math.floor(Math.random() * 1e9),
  message: { chat: { id: chatId, type: 'private' }, from: { id: chatId, username: 'aziz' }, text },
});

let baseUrl;
test.before(async () => {
  baseUrl = await start();
});
test.after(async () => {
  _setTransport(null);
  await stop();
});

/** Ro'yxatdan o'tgan foydalanuvchi + uning bog'lash kodi */
const registerAndGetCode = async () => {
  const api = makeClient();
  api.baseUrl = baseUrl;
  await api.register();
  const link = await api.post('/api/telegram/link');
  assert.equal(link.status, 200);
  const code = new URL(link.data.url).searchParams.get('start');
  return { api, code, url: link.data.url };
};

test('bog\'lash: havola → /start <kod> → hisob ulanadi, kod bir martalik', async () => {
  const { api, code, url } = await registerAndGetCode();
  assert.match(url, /^https:\/\/t\.me\/linguist_test_bot\?start=[A-Za-z0-9_-]+$/);

  const before = await api.get('/api/telegram/status');
  assert.equal(before.data.configured, true);
  assert.equal(before.data.linked, false);

  const chatId = 1001;
  const res = await webhook(api, startUpdate(chatId, `/start ${code}`));
  assert.equal(res.status, 200);

  const after = await api.get('/api/telegram/status');
  assert.equal(after.data.linked, true);
  assert.equal(after.data.username, 'aziz');
  assert.match(lastMessageTo(chatId).body.text, /Hisob ulandi/);

  // Kod qayta ishlatilmaydi va bazada ochiq holda turmaydi
  const user = await User.findOne({ 'telegram.chatId': String(chatId) }).lean();
  assert.equal(user.telegram.linkCodeHash, undefined);
  assert.ok(!JSON.stringify(user).includes(code));

  await webhook(api, startUpdate(2002, `/start ${code}`));
  assert.match(lastMessageTo(2002).body.text, /eskirgan/);
  assert.equal(await User.countDocuments({ 'telegram.chatId': '2002' }), 0);
});

test('webhook sirsiz yoki noto\'g\'ri sir bilan rad etiladi', async () => {
  const api = { baseUrl };
  assert.equal((await webhook(api, startUpdate(1, '/start x'), 'wrong')).status, 401);
  assert.equal((await webhook(api, startUpdate(1, '/start x'), '')).status, 401);
});

test('muddati o\'tgan kod ishlamaydi', async () => {
  const { api, code } = await registerAndGetCode();
  const me = await api.get('/api/auth/me');
  await User.updateOne({ email: me.data.email }, { $set: { 'telegram.linkCodeExpires': new Date(Date.now() - 1000) } });

  await webhook(api, startUpdate(3003, `/start ${code}`));
  assert.equal((await api.get('/api/telegram/status')).data.linked, false);
});

test('bitta chat — bitta hisob: yangi hisobga ulansa eskisidan uziladi', async () => {
  const a = await registerAndGetCode();
  const b = await registerAndGetCode();
  await webhook(a.api, startUpdate(4004, `/start ${a.code}`));
  await webhook(b.api, startUpdate(4004, `/start ${b.code}`));

  assert.equal((await a.api.get('/api/telegram/status')).data.linked, false);
  assert.equal((await b.api.get('/api/telegram/status')).data.linked, true);
});

test('/stop va botni bloklash ulanishni uzadi; ilovadan uzish ham ishlaydi', async () => {
  const s = await registerAndGetCode();
  await webhook(s.api, startUpdate(5005, `/start ${s.code}`));
  await webhook(s.api, startUpdate(5005, '/stop'));
  assert.equal((await s.api.get('/api/telegram/status')).data.linked, false);

  const k = await registerAndGetCode();
  await webhook(k.api, startUpdate(6006, `/start ${k.code}`));
  await webhook(k.api, {
    update_id: 1,
    my_chat_member: { chat: { id: 6006, type: 'private' }, new_chat_member: { status: 'kicked' } },
  });
  assert.equal((await k.api.get('/api/telegram/status')).data.linked, false);

  const d = await registerAndGetCode();
  await webhook(d.api, startUpdate(7007, `/start ${d.code}`));
  const del = await d.api.del('/api/telegram/link');
  assert.equal(del.status, 200);
  assert.equal(del.data.linked, false);
});

test('/bugun bugungi rejani ko\'rsatadi', async () => {
  const s = await registerAndGetCode();
  await webhook(s.api, startUpdate(8008, `/start ${s.code}`));
  await webhook(s.api, startUpdate(8008, '/bugun'));
  const text = lastMessageTo(8008).body.text;
  assert.match(text, /Bugungi reja/);
  assert.match(text, /Kunlik sahna/);
});

test('guruh chatlari e\'tiborsiz qoldiriladi', async () => {
  const before = sent.length;
  await webhook({ baseUrl }, {
    update_id: 2,
    message: { chat: { id: -100, type: 'group' }, from: { id: 1 }, text: '/bugun' },
  });
  assert.equal(sent.length, before);
});

const AT_19_TASHKENT = new Date('2026-06-10T14:00:00Z');
const prepareForReminder = async (chatId) => {
  await User.updateOne(
    { 'telegram.chatId': String(chatId) },
    {
      $set: {
        'onboarding.completed': true,
        timezone: 'Asia/Tashkent',
        notifications: { email: { enabled: true, hour: 19, lastSentDay: '' } },
        dailyQuests: { date: '2026-06-10', reviewCompleted: false, topicCompleted: false },
        lastStreakDay: '2026-06-09',
      },
    }
  );
};

test('eslatma Telegram orqali ketadi (email emas)', async () => {
  const s = await registerAndGetCode();
  await webhook(s.api, startUpdate(9009, `/start ${s.code}`));
  await prepareForReminder(9009);

  const stats = await runReminders(AT_19_TASHKENT);
  assert.ok(stats.byChannel.telegram >= 1, JSON.stringify(stats));
  const msg = lastMessageTo(9009);
  assert.match(msg.body.text, /Qolgan qadamlar/);
  assert.equal(msg.body.parse_mode, 'HTML');
});

test('bot bloklangan bo\'lsa ulanish uziladi va eslatma boshqa kanalga o\'tadi', async () => {
  const s = await registerAndGetCode();
  await webhook(s.api, startUpdate(10010, `/start ${s.code}`));
  await prepareForReminder(10010);
  blockChats.add('10010');

  const me = await s.api.get('/api/auth/me');
  // Email zaxira kanali faqat tasdiqlangan manzilga ishlaydi
  await User.updateOne({ email: me.data.email }, { emailVerified: true });
  await runReminders(AT_19_TASHKENT);

  const user = await User.findOne({ email: me.data.email }).lean();
  assert.equal(user.telegram?.chatId, undefined, 'bloklangan chat uzilishi kerak');
  assert.equal(user.notifications.email.lastSentDay, '2026-06-10', 'email orqali yuborilgan deb hisoblanadi');
});

test("email tasdiqlanmagan bo'lsa zaxira xat yuborilmaydi va yuborilgan deb sanalmaydi", async () => {
  const s = await registerAndGetCode();
  await webhook(s.api, startUpdate(10011, `/start ${s.code}`));
  await prepareForReminder(10011);
  blockChats.add('10011');

  const me = await s.api.get('/api/auth/me');
  const stats = await runReminders(AT_19_TASHKENT);

  const user = await User.findOne({ email: me.data.email }).lean();
  assert.equal(user.notifications.email.lastSentDay || '', '', 'yuborilmagan eslatma yuborilgan deb yozildi');
  assert.ok(stats.reasons.email_unverified >= 1);
});

test('bot sozlanmagan bo\'lsa havola 503', async () => {
  const saved = process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.TELEGRAM_BOT_TOKEN;
  try {
    const api = makeClient();
    await api.register();
    assert.equal((await api.post('/api/telegram/link')).status, 503);
    assert.equal((await api.get('/api/telegram/status')).data.configured, false);
  } finally {
    process.env.TELEGRAM_BOT_TOKEN = saved;
  }
});
