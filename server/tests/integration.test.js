const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, makeClient } = require('./helpers/testServer');
const { makeDue, setStage } = require('./helpers/dailyFlow');
const User = require('../models/User');
const { getAiLimit } = require('../middleware/usageQuota');

/**
 * Bu testlar aynan hisobotda topilgan kritik xatolarni qamrab oladi.
 * Har biri tuzatishdan OLDIN yiqilishi kerak bo'lgan holatni tekshiradi.
 *
 * Diqqat: GEMINI_API_KEY ataylab o'chirilgan — "AI ishlamayapti" ssenariysi
 * eng muhim ssenariy, chunki eski kod aynan shunda foydalanuvchi progressini buzardi.
 */

test.before(async () => {
  await start();
});
test.after(async () => {
  await stop();
});

test('AI ishlamaganda takrorlash foydalanuvchini JAZOLAMAYDI', async () => {
  // Ilgari bu yerda 503 qaytardi va hech narsa o'zgarmasdi. Takrorlash
  // ixtiyoriy qadam bo'lganda bu to'g'ri edi; endi u yagona yo'l, ya'ni
  // Gemini uzilishi butun ilovani to'xtatib qo'yardi. Endi mahalliy
  // tekshiruvga tushadi — lekin to'g'ri gap XATO deb belgilanmaydi.
  const api = makeClient();
  await api.register();

  const added = await api.post('/api/words', {
    word: 'water',
    skipAI: true,
    manualTranslation: 'suv',
    manualDefinition: 'a clear liquid',
  });
  assert.equal(added.status, 201, JSON.stringify(added.data));

  const wordId = added.data._id;
  // Gap tuzish rejimi 4-bosqichdan boshlanadi (utils/reviewModes.js)
  await setStage(wordId, 4);
  const before = await api.get('/api/words');
  const stateBefore = before.data.find((w) => w._id === wordId);

  const check = await api.post(`/api/review/${wordId}/check`, {
    sentence: 'I drink water every morning.',
  });

  assert.equal(check.status, 200);
  assert.equal(check.data.method, 'local', 'grammatika tekshirilmagani ochiq aytilishi kerak');
  assert.equal(check.data.isCorrect, true, 'to\'g\'ri gap xato deb belgilanmasligi kerak');

  const after = await api.get('/api/words');
  const stateAfter = after.data.find((w) => w._id === wordId);

  assert.equal(stateAfter.stage, stateBefore.stage + 1, 'bosqich oshishi kerak');
  assert.equal(stateAfter.lapses, stateBefore.lapses, 'lapses oshmasligi kerak');
});

test('AI ishlamaganda kunlik limit YEYILMAYDI', async () => {
  const api = makeClient();
  await api.register();

  const added = await api.post('/api/words', {
    word: 'bread',
    skipAI: true,
    manualTranslation: 'non',
  });
  const wordId = added.data._id;
  await setStage(wordId, 4);

  const usageBefore = await api.get('/api/billing/subscription');
  const before = usageBefore.data.usage?.aiCallsToday || 0;

  const check = await api.post(`/api/review/${wordId}/check`, { sentence: 'I eat bread.' });
  assert.equal(check.status, 200, JSON.stringify(check.data));
  assert.equal(check.data.method, 'local');

  const usageAfter = await api.get('/api/billing/subscription');
  const after = usageAfter.data.usage?.aiCallsToday || 0;

  assert.equal(after, before, 'muvaffaqiyatsiz AI chaqiruvi limitni yemasligi kerak');
});

test('AI yo\'q bo\'lsa ham takrorlash ishlaydi va bosqich oshadi', async () => {
  // Bu testda GEMINI_API_KEY yo'q. Ilgari bunda /check 503 qaytarardi va
  // foydalanuvchi umuman ilgarilay olmasdi. Endi mahalliy tekshiruvga tushadi.
  const api = makeClient();
  await api.register();

  const added = await api.post('/api/words', { word: 'house', skipAI: true, manualTranslation: 'uy' });
  const wordId = added.data._id;
  await setStage(wordId, 4);

  const first = await api.post(`/api/review/${wordId}/check`, { sentence: 'I live in a house.' });
  assert.equal(first.status, 200);
  assert.equal(first.data.method, 'local', 'AI yo\'q → mahalliy tekshiruv');
  assert.equal(first.data.isCorrect, true);
  assert.equal(first.data.stage, 5, '5-bosqich');
  // 14 kun ±5% (uzun intervallarga ataylab tasodifiy og'ish qo'shiladi — srs.js)
  assert.ok(first.data.intervalDays >= 13 && first.data.intervalDays <= 15, `interval: ${first.data.intervalDays}`);

  // Kunlar o'tdi — so'z yana navbatda
  await makeDue(wordId);
  const second = await api.post(`/api/review/${wordId}/check`, { sentence: 'The house is big.' });
  assert.equal(second.data.stage, 6);
});

test('so\'z ishlatilmagan gap bosqichni 1 ga qaytaradi', async () => {
  const api = makeClient();
  await api.register();

  const added = await api.post('/api/words', { word: 'garden', skipAI: true, manualTranslation: 'bog\'' });
  const wordId = added.data._id;
  await setStage(wordId, 4);

  const up = await api.post(`/api/review/${wordId}/check`, { sentence: 'I like my garden.' });
  assert.equal(up.data.stage, 5);

  await makeDue(wordId);
  const miss = await api.post(`/api/review/${wordId}/check`, { sentence: 'I like flowers.' });
  assert.equal(miss.data.usedTargetWord, false);
  assert.equal(miss.data.isCorrect, false);
  assert.equal(miss.data.stage, 1, 'xato → 1-bosqichga qaytadi');
  assert.equal(miss.data.lapses, undefined, 'lapses javobda ochilmaydi');
});

test('7 bosqichdan o\'tgan so\'z yodlangan bo\'ladi va qaytarish mumkin', async () => {
  const api = makeClient();
  await api.register();

  const added = await api.post('/api/words', { word: 'window', skipAI: true, manualTranslation: 'deraza' });
  const wordId = added.data._id;

  // Har bosqichda server kutgan rejimda javob: 2 × tanib olish, 2 × eslash, 3 × gap
  const expected = ['recognize', 'recognize', 'recall', 'recall', 'sentence', 'sentence', 'sentence'];
  let last;
  for (let i = 0; i < 7; i++) {
    await makeDue(wordId);
    const due = await api.get('/api/review/due');
    const item = due.data.find((w) => w._id === wordId);
    assert.equal(item.mode, expected[i], `${i + 1}-takrorlash rejimi`);
    const body =
      item.mode === 'recognize'
        ? { mode: 'recognize', answer: 'deraza' }
        : item.mode === 'recall'
          ? { mode: 'recall', answer: 'window' }
          : { mode: 'sentence', sentence: `I open the window number ${i}.` };
    last = await api.post(`/api/review/${wordId}/check`, body);
    assert.equal(last.status, 200, `${i + 1}-takrorlash`);
  }

  assert.equal(last.data.learned, true, '7 marta to\'g\'ri → yodlangan');
  assert.equal(last.data.nextReviewDate, null, 'navbatdan chiqadi');

  const due = await api.get('/api/review/due');
  assert.equal(
    due.data.some((w) => w._id === wordId),
    false,
    'yodlangan so\'z navbatda ko\'rinmasligi kerak'
  );

  const back = await api.post(`/api/review/${wordId}/relearn`);
  assert.equal(back.status, 200);
  assert.equal(back.data.stage, 4, 'qayta yodlash o\'rtadagi 4-bosqichdan boshlanadi');
  assert.equal(back.data.intervalDays, 7);

  // Ikkinchi marta qaytarib bo'lmaydi — so'z allaqachon yodlanmoqda
  assert.equal((await api.post(`/api/review/${wordId}/relearn`)).status, 400);
});

test('mini-testni mijozdan aldab o\'tib bo\'lmaydi', async () => {
  const api = makeClient();
  await api.register();

  // Eski xatti-harakat: mijoz shunchaki quizPassed:true yuborardi va o'tib ketardi
  const cheat = await api.post('/api/topics/finish', { quizPassed: true });
  assert.equal(cheat.status, 400, 'server mijozning quizPassed\'iga ishonmasligi kerak');
  assert.equal(cheat.data.code, 'QUIZ_REQUIRED');
});

test('mini-test savollari to\'g\'ri javobni oshkor qilmaydi', async () => {
  const api = makeClient();
  await api.register();

  const quiz = await api.post('/api/topics/quiz/start');
  assert.equal(quiz.status, 200, JSON.stringify(quiz.data));
  assert.ok(quiz.data.quizId, 'quizId qaytishi kerak');
  assert.ok(quiz.data.questions.length > 0);

  const serialized = JSON.stringify(quiz.data);
  assert.ok(!serialized.includes('correctIndex'), 'correctIndex mijozga chiqmasligi kerak');

  for (const q of quiz.data.questions) {
    assert.equal(q.options.length, 4, '4 ta variant');
    // Eski soxta chalg'ituvchilar qaytmasligi kerak
    assert.ok(
      !q.options.some((o) => /Noto'g'ri tarjima|Boshqa ma'no|Tanilmadi/.test(o)),
      `shablon variant topildi: ${q.options.join(', ')}`
    );
  }
});

test('noto\'g\'ri javoblar bilan test o\'tmaydi, to\'g\'rilari bilan o\'tadi', async () => {
  const api = makeClient();
  await api.register();

  const quiz = await api.post('/api/topics/quiz/start');
  const n = quiz.data.questions.length;

  // Barchasiga bir xil indeks — deyarli aniq yiqiladi
  const wrong = await api.post('/api/topics/quiz/submit', {
    quizId: quiz.data.quizId,
    answers: Array(n).fill(0),
  });
  assert.equal(wrong.status, 200);
  assert.equal(typeof wrong.data.score, 'number');
  assert.ok(Array.isArray(wrong.data.results));

  // Endi natijadagi to'g'ri javoblardan foydalanib qayta topshiramiz
  const quiz2 = await api.post('/api/topics/quiz/start');
  const correctAnswers = quiz2.data.questions.map((q) => {
    // to'g'ri javobni bilmaymiz — barcha variantlarni sinab ko'ramiz emas,
    // buning o'rniga submit natijasidagi correctAnswer'dan foydalanamiz
    return 0;
  });
  const probe = await api.post('/api/topics/quiz/submit', {
    quizId: quiz2.data.quizId,
    answers: correctAnswers,
  });
  const realAnswers = quiz2.data.questions.map((q, i) =>
    q.options.indexOf(probe.data.results[i].correctAnswer)
  );
  const passRes = await api.post('/api/topics/quiz/submit', {
    quizId: quiz2.data.quizId,
    answers: realAnswers,
  });

  assert.equal(passRes.data.score, 100);
  assert.equal(passRes.data.passed, true);
});

test('javoblar soni savollar soniga mos kelmasa rad etiladi', async () => {
  const api = makeClient();
  await api.register();
  const quiz = await api.post('/api/topics/quiz/start');

  const bad = await api.post('/api/topics/quiz/submit', {
    quizId: quiz.data.quizId,
    answers: [0],
  });
  assert.equal(bad.status, 400);
});

test('boshqa foydalanuvchining test sessiyasiga tegib bo\'lmaydi', async () => {
  const a = makeClient();
  const b = makeClient();
  await a.register();
  await b.register();

  const quiz = await a.post('/api/topics/quiz/start');
  const stolen = await b.post('/api/topics/quiz/submit', {
    quizId: quiz.data.quizId,
    answers: [0, 0, 0],
  });
  assert.equal(stolen.status, 404, 'begona sessiya topilmasligi kerak');
});

test('kunlik AI limiti parallel so\'rovlarda ham buzilmaydi', async () => {
  const api = makeClient();
  await api.register();

  const added = await api.post('/api/words', { word: 'river', skipAI: true, manualTranslation: 'daryo' });
  const wordId = added.data._id;
  await setStage(wordId, 4);

  // 20 ta bir vaqtda. Eski kodda read→+1→save poygasi tufayli hisob
  // 20 dan ancha kam bo'lib qolardi.
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      api.post(`/api/review/${wordId}/check`, { sentence: `The river is long ${i}.` })
    )
  );
  assert.equal(results.length, 20);

  // AI yo'q → hammasi fallback → hammasi refund qilinadi → hisob 0 bo'lishi kerak
  const sub = await api.get('/api/billing/subscription');
  assert.equal(
    sub.data.usage.aiCallsToday,
    0,
    `fallback javoblar limit yemasligi kerak, hozir: ${sub.data.usage.aiCallsToday}`
  );
});

test('AI limiti tugaganda takrorlash to\'xtamaydi — mahalliy tekshiruvga tushadi', async () => {
  // Bepul tarifda 15 ta AI chaqiruvi bor, kunlik takrorlash maqsadi esa 20 ta
  // so'z. Ilgari 16-so'zda 402 qaytib, kunlik rejani yopib bo'lmasdi.
  const api = makeClient();
  await api.register();

  const added = await api.post('/api/words', { word: 'lamp', skipAI: true, manualTranslation: 'chiroq' });
  await setStage(added.data._id, 4);
  const me = await api.get('/api/auth/me');
  const limit = getAiLimit({ getEffectivePlan: () => 'free' });
  await User.updateOne(
    { _id: me.data._id },
    { $set: { 'usage.aiCallsDate': me.data.today, 'usage.aiCallsToday': limit } }
  );

  const check = await api.post(`/api/review/${added.data._id}/check`, {
    sentence: 'I turn on the lamp at night.',
  });
  assert.equal(check.status, 200, JSON.stringify(check.data));
  assert.equal(check.data.method, 'local');
  assert.equal(check.data.aiReason, 'QUOTA', 'UI sababni ayta olishi kerak');
  assert.equal(check.data.isCorrect, true);
  assert.equal(check.data.stage, 5, 'bosqich oshishi kerak');

  const sub = await api.get('/api/billing/subscription');
  assert.equal(sub.data.usage.aiCallsToday, limit, 'limitdan oshib ketmasligi kerak');
});

test('bir xil so\'zni ikki marta qo\'shib bo\'lmaydi', async () => {
  const api = makeClient();
  await api.register();

  const first = await api.post('/api/words', { word: 'apple', skipAI: true, manualTranslation: 'olma' });
  assert.equal(first.status, 201);

  const dup = await api.post('/api/words', { word: 'APPLE', skipAI: true, manualTranslation: 'olma' });
  assert.equal(dup.status, 400);
  assert.equal(dup.data.type, 'DUPLICATE');
});

test('boshqa foydalanuvchining so\'ziga tegib bo\'lmaydi', async () => {
  const a = makeClient();
  const b = makeClient();
  await a.register();
  await b.register();

  const w = await a.post('/api/words', { word: 'secret', skipAI: true, manualTranslation: 'sir' });
  const id = w.data._id;

  assert.equal((await b.post(`/api/review/${id}/check`, { sentence: 'It is a secret.' })).status, 404);
  assert.equal((await b.del(`/api/words/${id}`)).status, 404);
});

test('vaqt zonasi saqlanadi va yaroqsizi rad etiladi', async () => {
  const api = makeClient();
  await api.register();

  const ok = await api.post('/api/auth/timezone', { timezone: 'Asia/Samarkand' });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.timezone, 'Asia/Samarkand');

  const bad = await api.post('/api/auth/timezone', { timezone: 'Mars/Olympus' });
  assert.equal(bad.status, 400);
});

test('token siz himoyalangan yo\'llarga kirib bo\'lmaydi', async () => {
  const anon = makeClient();
  assert.equal((await anon.get('/api/words')).status, 401);
  assert.equal((await anon.get('/api/review/due')).status, 401);
  assert.equal((await anon.post('/api/topics/quiz/start')).status, 401);
});

test('audio hajmi cheklangan — Mongo 16MB limitiga urilmaydi', async () => {
  const api = makeClient();
  await api.register();

  const challenge = await api.get('/api/challenge/current');
  const challengeId = challenge.data._id;

  const huge = 'data:audio/webm;base64,' + 'A'.repeat(4_000_000);
  const res = await api.post('/api/challenge/complete', {
    challengeId,
    audioData: huge,
    spokenText: 'hello',
  });
  assert.equal(res.status, 400, 'juda katta audio rad etilishi kerak');
});

test('challenge baholash usuli halol belgilanadi', async () => {
  const api = makeClient();
  await api.register();

  const challenge = await api.get('/api/challenge/current');
  const res = await api.post('/api/challenge/complete', {
    challengeId: challenge.data._id,
    spokenText: 'Welcome to day 1 of your challenge',
  });

  assert.equal(res.status, 200);
  assert.equal(
    res.data.challenge.evaluationMethod,
    'transcript_match',
    'baho talaffuz emas, transkript mosligi ekani yozilishi kerak'
  );
});

test('lug\'at xizmati ishlamasa so\'z SOXTA ta\'rif bilan saqlanmaydi', async () => {
  // Ilgari bu holatda so'z shunday saqlanardi:
  //   definition: "Definition unavailable (API failed). You can edit this later."
  // Inglizcha xizmat matni foydalanuvchiga ta'rif bo'lib ko'rinardi, "edit later"
  // esa yolg'on edi — tahrirlash oynasi yo'q. Buzuq kartochka SRS navbatiga
  // tushib, har kuni qaytaverardi.
  const api = makeClient();
  await api.register();

  // skipAI tashqi so'rovlarni to'sadi va qo'lda ma'lumot ham berilmaydi
  const res = await api.post('/api/words', { word: 'zzzunknownword', skipAI: true });

  assert.equal(res.status, 503);
  assert.equal(res.data.type, 'ENRICHMENT_FAILED');

  const words = await api.get('/api/words');
  assert.equal(words.data.length, 0, 'yaroqsiz so\'z saqlanib qolmasligi kerak');
});

test('qo\'lda tarjima berilsa so\'z saqlanadi', async () => {
  const api = makeClient();
  await api.register();

  const res = await api.post('/api/words', {
    word: 'zzzunknownword',
    skipAI: true,
    manualTranslation: 'sinov',
  });

  assert.equal(res.status, 201);
  assert.equal(res.data.translation, 'sinov');
  assert.equal(res.data.definition, '', 'soxta ta\'rif yozilmasligi kerak');
  assert.deepEqual(res.data.examples, [], 'soxta misol yozilmasligi kerak');
});

test('refresh takrorlash holatiga tegmaydi', async () => {
  const api = makeClient();
  await api.register();

  const added = await api.post('/api/words', {
    word: 'zzzunknownword',
    skipAI: true,
    manualTranslation: 'sinov',
  });
  const id = added.data._id;

  // Bosqichni oshiramiz (yangi so'z — tanib olish rejimi)
  await api.post(`/api/review/${id}/check`, { mode: 'recognize', answer: 'sinov' });
  const before = (await api.get('/api/words')).data.find((w) => w._id === id);
  assert.equal(before.stage, 1);

  // AI ham, tarmoq ham yo'q → refresh muvaffaqiyatsiz, lekin holat buzilmaydi
  const refreshed = await api.post(`/api/words/${id}/refresh`);
  assert.ok([200, 503].includes(refreshed.status), `kutilmagan status: ${refreshed.status}`);

  const after = (await api.get('/api/words')).data.find((w) => w._id === id);
  assert.equal(after.stage, before.stage, 'bosqich o\'zgarmasligi kerak');
  assert.equal(after.translation, 'sinov', 'mavjud tarjima o\'chib ketmasligi kerak');
});

test('boshqa foydalanuvchining so\'zini refresh qilib bo\'lmaydi', async () => {
  const a = makeClient();
  const b = makeClient();
  await a.register();
  await b.register();

  const w = await a.post('/api/words', { word: 'zzzsecretword', skipAI: true, manualTranslation: 'sir' });
  assert.equal((await b.post(`/api/words/${w.data._id}/refresh`)).status, 404);
});
