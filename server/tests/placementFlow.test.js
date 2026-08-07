const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, makeClient } = require('./helpers/testServer');
const { getItemById } = require('../content/placement');

test.before(async () => {
  await start();
});
test.after(async () => {
  await stop();
});

/**
 * Testni oxirigacha o'tkazadi.
 * @param {(item) => number} answerFn  javob indeksini tanlaydigan funksiya
 */
const runPlacement = async (api, answerFn) => {
  const started = await api.post('/api/placement/start');
  assert.equal(started.status, 200, JSON.stringify(started.data));

  let sessionId = started.data.sessionId;
  let question = started.data.question;
  let last = null;
  let guard = 0;

  while (question) {
    const item = getItemById(question.itemId);
    const res = await api.post('/api/placement/answer', {
      sessionId,
      itemId: question.itemId,
      answered: answerFn(item),
    });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    last = res.data;
    question = res.data.done ? null : res.data.question;

    guard++;
    assert.ok(guard <= 20, 'test tugamadi');
  }
  return last;
};

test("to'g'ri javoblar yuqori daraja beradi", async () => {
  const api = makeClient();
  await api.register();

  const result = await runPlacement(api, (item) => item.correct);

  assert.equal(result.done, true);
  assert.equal(result.resultCefr, 'B2');
  assert.equal(result.learnerLevel, 'advanced');
  assert.ok(result.totalQuestions <= 12);
});

test("noto'g'ri javoblar eng past darajani beradi", async () => {
  const api = makeClient();
  await api.register();

  const result = await runPlacement(api, (item) => (item.correct + 1) % 4);

  assert.equal(result.resultCefr, 'A1');
  assert.equal(result.learnerLevel, 'beginner');
});

test("to'g'ri javob mijozga YUBORILMAYDI", async () => {
  const api = makeClient();
  await api.register();

  const started = await api.post('/api/placement/start');
  const serialized = JSON.stringify(started.data);

  assert.ok(!serialized.includes('"correct"'), "to'g'ri javob indeksi oshkor bo'ldi");
  assert.equal(started.data.question.options.length, 4);
  assert.ok(started.data.question.prompt);
});

test('kutilmagan savolga javob rad etiladi', async () => {
  const api = makeClient();
  await api.register();

  const started = await api.post('/api/placement/start');
  // Mijoz o'ziga qulay savolni tanlab yubormasin
  const res = await api.post('/api/placement/answer', {
    sessionId: started.data.sessionId,
    itemId: 'a1-1',
    answered: 0,
  });

  if (started.data.question.itemId !== 'a1-1') {
    assert.equal(res.status, 400);
    assert.equal(res.data.code, 'UNEXPECTED_ITEM');
  }
});

test("yakunlangan testga qayta javob berib bo'lmaydi", async () => {
  const api = makeClient();
  await api.register();

  const started = await api.post('/api/placement/start');
  const sessionId = started.data.sessionId;
  let question = started.data.question;

  while (question) {
    const item = getItemById(question.itemId);
    const res = await api.post('/api/placement/answer', {
      sessionId,
      itemId: question.itemId,
      answered: item.correct,
    });
    question = res.data.done ? null : res.data.question;
  }

  const after = await api.post('/api/placement/answer', {
    sessionId,
    itemId: 'a1-1',
    answered: 0,
  });
  assert.equal(after.status, 400);
  assert.equal(after.data.code, 'ALREADY_DONE');
});

test('boshqa foydalanuvchining sessiyasiga tegib bo\'lmaydi', async () => {
  const a = makeClient();
  const b = makeClient();
  await a.register();
  await b.register();

  const started = await a.post('/api/placement/start');
  const stolen = await b.post('/api/placement/answer', {
    sessionId: started.data.sessionId,
    itemId: started.data.question.itemId,
    answered: 0,
  });
  assert.equal(stolen.status, 404);
});

test('B2 natija kursni B1 blokidan boshlaydi, A1 dan emas', async () => {
  const api = makeClient();
  await api.register();

  const before = await api.get('/api/topics/current');
  assert.equal(before.data.day, 1, 'boshlang\'ich holat 1-kun');
  assert.equal(before.data.cefr, 'A1');

  const result = await runPlacement(api, (item) => item.correct);
  assert.ok(result.startDay > 1, `kurs hali ham 1-kundan boshlanyapti: ${result.startDay}`);

  const after = await api.get('/api/topics/current');
  assert.equal(after.data.day, result.startDay);
  assert.notEqual(
    after.data.topic,
    before.data.topic,
    'yuqori darajali foydalanuvchi ham bir xil mavzuni oldi'
  );
  // Mavjud kontentdagi eng yuqori daraja A2 — B2 uchun shundan boshlanadi
  assert.ok(['A2', 'B1', 'B2'].includes(after.data.cefr), `kutilmagan daraja: ${after.data.cefr}`);
});

test('A1 natija 1-kundan boshlaydi', async () => {
  const api = makeClient();
  await api.register();

  const result = await runPlacement(api, (item) => (item.correct + 1) % 4);
  assert.equal(result.startDay, 1);

  const topic = await api.get('/api/topics/current');
  assert.equal(topic.data.cefr, 'A1');
});

test('qo\'lda tanlangan daraja ham boshlanish kunini o\'zgartiradi', async () => {
  const api = makeClient();
  await api.register();

  await api.post('/api/auth/onboard', {
    level: 'intermediate',
    goal: 'speaking',
    planType: 'standard',
  });

  const topic = await api.get('/api/topics/current');
  assert.ok(topic.data.day > 1, `intermediate hali ham 1-kunda: ${topic.data.day}`);
});

test('natija profilga yoziladi va o\'qib olinadi', async () => {
  const api = makeClient();
  await api.register();

  await runPlacement(api, (item) => item.correct);

  const result = await api.get('/api/placement/result');
  assert.equal(result.data.hasResult, true);
  assert.equal(result.data.resultCefr, 'B2');
  assert.equal(result.data.learnerLevel, 'advanced');

  const me = await api.get('/api/auth/me');
  assert.equal(me.data.onboarding.level, 'advanced');
  assert.equal(me.data.onboarding.placedCefr, 'B2');
  // Placement darajani o'lchaydi, lekin onboarding'ni YAKUNLAMAYDI —
  // maqsad va reja hali so'ralmagan
  assert.equal(me.data.onboarding.completed, false);
});

test('onboarding placement natijasini saqlab qoladi', async () => {
  const api = makeClient();
  await api.register();

  await runPlacement(api, (item) => item.correct);
  const afterPlacement = await api.get('/api/topics/current');

  // Foydalanuvchi o'lchangan daraja bilan onboarding'ni yakunlaydi
  await api.post('/api/auth/onboard', {
    level: 'advanced',
    goal: 'speaking',
    planType: 'standard',
  });

  const me = await api.get('/api/auth/me');
  assert.equal(me.data.onboarding.completed, true);
  assert.equal(me.data.onboarding.placedCefr, 'B2', 'o\'lchangan daraja yo\'qoldi');

  const afterOnboard = await api.get('/api/topics/current');
  assert.equal(afterOnboard.data.day, afterPlacement.data.day, 'boshlanish kuni siljidi');
});

test('boshlangan kursni qayta test buzmaydi', async () => {
  const api = makeClient();
  await api.register();

  // Foydalanuvchi 1-kunni tugatgan deb faraz qilamiz
  const topic = await api.get('/api/topics/current');
  for (const w of topic.data.words) {
    await api.post('/api/words', {
      word: w.word,
      skipAI: true,
      fromTopic: true,
      manualTranslation: w.translation,
    });
  }
  const quiz = await api.post('/api/topics/quiz/start');
  const probe = await api.post('/api/topics/quiz/submit', {
    quizId: quiz.data.quizId,
    answers: Array(quiz.data.questions.length).fill(0),
  });
  const answers = quiz.data.questions.map((q, i) =>
    q.options.indexOf(probe.data.results[i].correctAnswer)
  );
  await api.post('/api/topics/quiz/submit', { quizId: quiz.data.quizId, answers });
  const finished = await api.post('/api/topics/finish', {});
  assert.equal(finished.status, 200);

  const afterFinish = await api.get('/api/topics/current');
  const dayAfterFinish = afterFinish.data.day;

  // Endi placement topshiramiz — progress orqaga siljimasligi kerak
  await runPlacement(api, (item) => item.correct);

  const afterPlacement = await api.get('/api/topics/current');
  assert.equal(
    afterPlacement.data.day,
    dayAfterFinish,
    'qayta test boshlangan kursni siljitib yubordi'
  );
});
