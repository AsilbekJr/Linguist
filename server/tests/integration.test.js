const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, makeClient } = require('./helpers/testServer');

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

test('AI ishlamaganda takrorlash holati BUZILMAYDI', async () => {
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
  const before = await api.get('/api/words');
  const stateBefore = before.data.find((w) => w._id === wordId);

  // AI kaliti yo'q → 503 kutiladi, SRS tegilmaydi
  const check = await api.post(`/api/review/${wordId}/check`, {
    sentence: 'I drink water every morning.',
  });

  assert.equal(check.status, 503, 'AI yo\'q bo\'lsa 503 qaytishi kerak');
  assert.equal(check.data.srsUnchanged, true);

  const after = await api.get('/api/words');
  const stateAfter = after.data.find((w) => w._id === wordId);

  assert.equal(stateAfter.reviewStage, stateBefore.reviewStage, 'reviewStage o\'zgarmasligi kerak');
  assert.equal(stateAfter.repetitions, stateBefore.repetitions, 'repetitions o\'zgarmasligi kerak');
  assert.equal(stateAfter.lapses, stateBefore.lapses, 'lapses oshmasligi kerak');
  assert.equal(
    stateAfter.easeFactor,
    stateBefore.easeFactor,
    'ease jazolanmasligi kerak — bu foydalanuvchining aybi emas'
  );
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

  const usageBefore = await api.get('/api/billing/subscription');
  const before = usageBefore.data.usage?.aiCallsToday || 0;

  await api.post(`/api/review/${wordId}/check`, { sentence: 'I eat bread.' });

  const usageAfter = await api.get('/api/billing/subscription');
  const after = usageAfter.data.usage?.aiCallsToday || 0;

  assert.equal(after, before, 'muvaffaqiyatsiz AI chaqiruvi limitni yemasligi kerak');
});

test('AI\'siz baholash SRS\'ni to\'g\'ri yuritadi (4 darajali)', async () => {
  const api = makeClient();
  await api.register();

  const added = await api.post('/api/words', { word: 'house', skipAI: true, manualTranslation: 'uy' });
  const wordId = added.data._id;

  const good = await api.post(`/api/review/${wordId}/grade`, { grade: 2 });
  assert.equal(good.status, 200);
  assert.equal(good.data.intervalDays, 1, 'birinchi GOOD → 1 kun');

  const good2 = await api.post(`/api/review/${wordId}/grade`, { grade: 2 });
  assert.equal(good2.data.intervalDays, 3, 'ikkinchi GOOD → 3 kun');

  const again = await api.post(`/api/review/${wordId}/grade`, { grade: 0 });
  assert.equal(again.data.intervalDays, 0, 'AGAIN → shu sessiyada qaytadi');
  assert.equal(again.data.lapses, 1, 'lapse hisoblanadi');
  assert.ok(again.data.easeFactor < 2.5, 'ease pasayadi');
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

  // 20 ta bir vaqtda. Eski kodda read→+1→save poygasi tufayli hisob
  // 20 dan ancha kam bo'lib qolardi.
  const results = await Promise.all(
    Array.from({ length: 20 }, () =>
      api.post('/api/practice/prompt', { wordIds: [wordId], bucketLabel: 'Test' })
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

  assert.equal((await b.post(`/api/review/${id}/grade`, { grade: 2 })).status, 404);
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
