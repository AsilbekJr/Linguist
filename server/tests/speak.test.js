const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, makeClient } = require('./helpers/testServer');
const { finishTopicDay, finishSpeakDay, reviewAllDue } = require('./helpers/dailyFlow');

/**
 * Suhbat — kunlik rejaning majburiy ikkinchi qadami.
 *
 * Testlarda Gemini yo'q: qahramon sahna dialogi bo'yicha javob beradi
 * (ssenariy rejimi — ishlab chiqarishda AI ishlamay qolganda ham shu yo'l).
 * AI rejimi alohida, Gemini funksiyalari almashtirilgan holda sinaladi.
 */

test.before(async () => {
  await start();
});
test.after(async () => {
  await stop();
});

const gemini = require('../services/geminiService');
const User = require('../models/User');
const Conversation = require('../models/Conversation');

const newUserWithScene = async () => {
  const api = makeClient();
  await api.register();
  const finish = await finishTopicDay(api);
  assert.equal(finish.status, 200, JSON.stringify(finish.data));
  return api;
};

test('sahnasiz suhbat boshlanmaydi', async () => {
  const api = makeClient();
  await api.register();
  const today = await api.get('/api/speak/today');
  assert.equal(today.status, 200);
  assert.equal(today.data.sceneDone, false);
  assert.equal(today.data.canStartNew, false);
  assert.ok(today.data.preview.partner.name, "qahramon oldindan ko'rinadi");

  const res = await api.post('/api/speak/start');
  assert.equal(res.status, 409);
  assert.equal(res.data.code, 'SCENE_FIRST');
});

test("ssenariy rejimi: qahramon sahna dialogidan gapiradi, so'zlar server tomonida belgilanadi", async () => {
  const api = await newUserWithScene();
  const startRes = await api.post('/api/speak/start');
  assert.equal(startRes.status, 201, JSON.stringify(startRes.data));
  const conv = startRes.data.conversation;
  assert.equal(conv.mode, 'scripted');
  assert.equal(conv.turns.length, 1);
  assert.equal(conv.turns[0].role, 'partner');
  assert.ok(conv.targetWords.length > 0);

  // Qayta bosish yangi suhbat ochmaydi — o'sha davom etadi
  const again = await api.post('/api/speak/start');
  assert.equal(again.data.conversation.id, conv.id);
  assert.equal(again.data.resumed, true);

  const target = conv.targetWords[0].word;
  const turn = await api.post(`/api/speak/${conv.id}/turn`, {
    text: `I think the ${target} is important for me.`,
    via: 'voice',
    seconds: 4,
  });
  assert.equal(turn.status, 200, JSON.stringify(turn.data));
  assert.deepEqual(turn.data.newlyUsed, [target]);
  assert.equal(turn.data.conversation.wordsUsed, 1);
  assert.equal(turn.data.conversation.turns.length, 3, 'foydalanuvchi + qahramon javobi');
  assert.equal(turn.data.conversation.spokenSeconds, 4);
});

test("kamida 4 replikasiz yakunlanmaydi; yakunlangach qadam bajariladi", async () => {
  const api = await newUserWithScene();
  const conv = (await api.post('/api/speak/start')).data.conversation;
  await api.post(`/api/speak/${conv.id}/turn`, { text: 'Hello there.' });

  const early = await api.post(`/api/speak/${conv.id}/finish`);
  assert.equal(early.status, 409);
  assert.equal(early.data.code, 'NOT_ENOUGH_TURNS');

  for (let i = 0; i < 3; i++) await api.post(`/api/speak/${conv.id}/turn`, { text: `Answer number ${i}.` });
  const done = await api.post(`/api/speak/${conv.id}/finish`);
  assert.equal(done.status, 200, JSON.stringify(done.data));
  assert.equal(done.data.conversation.status, 'completed');
  assert.equal(done.data.dailyStep.speakCompleted, true);

  // Yakunlangan suhbatga replika yozilmaydi; qayta yakunlash xato bermaydi
  assert.equal((await api.post(`/api/speak/${conv.id}/turn`, { text: 'More?' })).status, 409);
  assert.equal((await api.post(`/api/speak/${conv.id}/finish`)).status, 200);
});

test('bepul tarif: kuniga 1 suhbat; Pro — yana boshlash mumkin', async () => {
  const api = await newUserWithScene();
  assert.equal((await finishSpeakDay(api)).status, 200);

  const second = await api.post('/api/speak/start');
  assert.equal(second.status, 403);
  assert.equal(second.data.code, 'SPEAK_LIMIT');

  const me = await api.get('/api/auth/me');
  await User.updateOne(
    { _id: me.data._id },
    { subscription: { plan: 'pro', status: 'active', currentPeriodEnd: new Date(Date.now() + 86400000) } }
  );
  const pro = await api.post('/api/speak/start');
  assert.equal(pro.status, 201, JSON.stringify(pro.data));
});

test('replikalar soni cheklangan', async () => {
  const api = await newUserWithScene();
  const conv = (await api.post('/api/speak/start')).data.conversation;
  for (let i = 0; i < conv.maxTurns; i++) {
    const r = await api.post(`/api/speak/${conv.id}/turn`, { text: `Line ${i}` });
    assert.equal(r.status, 200);
  }
  const over = await api.post(`/api/speak/${conv.id}/turn`, { text: 'One more' });
  assert.equal(over.status, 409);
  assert.equal(over.data.code, 'TURN_LIMIT');
});

test("boshqa foydalanuvchining suhbatiga tegib bo'lmaydi", async () => {
  const owner = await newUserWithScene();
  const conv = (await owner.post('/api/speak/start')).data.conversation;
  const stranger = makeClient();
  await stranger.register();
  assert.equal((await stranger.post(`/api/speak/${conv.id}/turn`, { text: 'hi' })).status, 404);
  assert.equal((await stranger.post(`/api/speak/${conv.id}/finish`)).status, 404);
  assert.equal((await stranger.post('/api/speak/not-an-id/turn', { text: 'hi' })).status, 404);
});

test("yordam: sahnadan ibora va hali ishlatilmagan so'zlar", async () => {
  const api = await newUserWithScene();
  const conv = (await api.post('/api/speak/start')).data.conversation;
  const hint = await api.post(`/api/speak/${conv.id}/hint`);
  assert.equal(hint.status, 200);
  assert.ok(hint.data.example?.text);
  assert.equal(hint.data.example.memorized, true, "sahnada yodlangan ibora birinchi taklif qilinishi kerak");
  assert.ok(hint.data.words.length > 0);

  // Xuddi shu ibora sahna paketida "Yod olish" uchun berilgan
  const topic = await api.get('/api/topics/current');
  assert.ok(topic.data.keyLines.some((l) => l.en === hint.data.example.text));
});

test('streak faqat Sahna + Suhbat + Takrorlash bajarilganda oshadi', async () => {
  const api = await newUserWithScene();
  const review = await reviewAllDue(api);
  assert.equal(review.data.dailyStep.planCompleted, false, 'suhbatsiz reja tugamasligi kerak');
  assert.equal((await api.get('/api/auth/me')).data.currentStreak, 0);

  const speak = await finishSpeakDay(api);
  assert.equal(speak.status, 200, JSON.stringify(speak.data));
  assert.equal(speak.data.dailyStep.planCompleted, true);
  assert.equal(speak.data.dailyStep.streakUpdated, true);
  assert.equal((await api.get('/api/auth/me')).data.currentStreak, 1);
});

test('AI rejimi: maqsadlar belgilanadi; AI uzilsa sahna dialogiga o\'tadi', async () => {
  const saved = { ...gemini };
  let replies = 0;
  gemini.isGeminiReady = () => true;
  let openedWith = null;
  gemini.openConversation = async (brief) => (openedWith = brief) && ({
    status: 'ok',
    opening: 'Hi! What can I do for you?',
    openingUz: 'Salom! Sizga nima kerak?',
    goals: ["Narxini so'rang", 'Rahmat ayting'],
  });
  gemini.conversationReply = async () => {
    replies += 1;
    if (replies === 1) return { status: 'ok', reply: 'It costs five dollars.', replyUz: 'Besh dollar.', goalsDone: [1] };
    return { status: 'unavailable', reason: 'QUOTA_EXCEEDED' };
  };
  gemini.conversationFeedback = async () => ({
    status: 'ok',
    summaryUz: 'Yaxshi!',
    corrections: [{ said: 'how much it cost', better: 'How much does it cost?', explanationUz: "Savolda 'does' kerak." }],
  });
  try {
    const api = await newUserWithScene();
    const conv = (await api.post('/api/speak/start')).data.conversation;
    assert.equal(conv.mode, 'ai');
    // Qahramon talaba sahnada yodlagan iboralarni biladi
    assert.ok(openedWith.phrases.length > 0, 'yodlangan iboralar promptga berilmadi');
    // Onboarding maqsadi qahramon uslubiga yetib boradi
    assert.equal(openedWith.goal, 'speaking');
    assert.equal(conv.goals.length, 2);

    const t1 = await api.post(`/api/speak/${conv.id}/turn`, { text: 'how much it cost' });
    assert.deepEqual(t1.data.newlyDone, ['g1']);
    assert.equal(t1.data.conversation.goals[0].done, true);

    const t2 = await api.post(`/api/speak/${conv.id}/turn`, { text: 'ok thanks' });
    assert.equal(t2.status, 200);
    assert.equal(t2.data.conversation.mode, 'scripted', "AI uzilganda qadam bloklanmasligi kerak");

    for (let i = 0; i < 2; i++) await api.post(`/api/speak/${conv.id}/turn`, { text: `fine ${i}` });
    const done = await api.post(`/api/speak/${conv.id}/finish`);
    assert.equal(done.data.conversation.feedback.corrections.length, 1);
    assert.equal(done.data.conversation.feedback.summaryUz, 'Yaxshi!');

    const stored = await Conversation.findById(conv.id).lean();
    assert.equal(stored.status, 'completed');
  } finally {
    Object.assign(gemini, saved);
  }
});

test("ssenariy dialogi tugasa qahramon xayrlashuvni takrorlamaydi — suhbat davom etadi", async () => {
  const api = await newUserWithScene();
  const conv = (await api.post('/api/speak/start')).data.conversation;
  let last = null;
  for (let i = 0; i < conv.minTurns; i++) {
    last = (await api.post(`/api/speak/${conv.id}/turn`, { text: `Sentence number ${i}.` })).data.conversation;
  }
  const partnerLines = last.turns.filter((t) => t.role === 'partner').map((t) => t.text);
  const farewells = partnerLines.filter((t) => t.startsWith('Thank you for talking'));
  assert.equal(farewells.length, 0, `kerakli javoblar soniga yetguncha xayrlashdi: ${partnerLines.join(' | ')}`);
});
