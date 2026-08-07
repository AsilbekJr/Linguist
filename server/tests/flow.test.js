const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, makeClient } = require('./helpers/testServer');

/**
 * To'liq kunlik oqim: kunlik sahna → mini-test → so'z saqlash → yakunlash → takrorlash.
 *
 * Bu testlar mijoz KUTAYOTGAN maydonlar haqiqatan kelayotganini tekshiradi.
 * Server javob shakli o'zgarganda mijoz jimgina buzilishi mumkin — build
 * ham, lint ham buni ushlamaydi.
 */

test.before(async () => {
  await start();
});
test.after(async () => {
  await stop();
});

/** Testdan o'tib, kunni yakunlaydigan yordamchi */
const passQuizAndFinish = async (api) => {
  const quiz = await api.post('/api/topics/quiz/start');
  const n = quiz.data.questions.length;

  // To'g'ri javoblarni aniqlash uchun bir marta topshirib, natijadan o'qiymiz
  const probe = await api.post('/api/topics/quiz/submit', {
    quizId: quiz.data.quizId,
    answers: Array(n).fill(0),
  });
  const answers = quiz.data.questions.map((q, i) =>
    q.options.indexOf(probe.data.results[i].correctAnswer)
  );
  const result = await api.post('/api/topics/quiz/submit', {
    quizId: quiz.data.quizId,
    answers,
  });
  return { quiz, result };
};

test('kunlik sahna mijoz kutayotgan barcha maydonlarni qaytaradi', async () => {
  const api = makeClient();
  await api.register();

  const res = await api.get('/api/topics/current');
  assert.equal(res.status, 200);

  const d = res.data;
  for (const field of ['day', 'topic', 'topicUz', 'story', 'words', 'dialogue', 'cefr', 'wordTarget', 'requiredCount']) {
    assert.ok(d[field] !== undefined && d[field] !== null, `"${field}" maydoni yo'q`);
  }

  assert.ok(d.dialogue.length >= 4, 'dialog qisqa');
  for (const line of d.dialogue) {
    assert.ok(line.speaker && line.en && line.uz, 'dialog qatori to\'liq emas');
  }

  // So'zlar boyitilgan bo'lishi kerak — mijoz IPA, ta'rif va misolni ko'rsatadi
  for (const w of d.words) {
    for (const field of ['word', 'translation', 'phonetic', 'definition', 'example', 'partOfSpeech']) {
      assert.ok(w[field], `"${w.word}" da "${field}" yo'q`);
    }
  }
  assert.equal(d.quizPassed, false, 'boshida test o\'tilmagan bo\'lishi kerak');
});

test('to\'liq kunlik oqim: test → so\'z saqlash → yakunlash', async () => {
  const api = makeClient();
  await api.register();

  const topic = await api.get('/api/topics/current');
  const words = topic.data.words;
  assert.ok(words.length > 0);

  // 1) Testni o'tish
  const { result } = await passQuizAndFinish(api);
  assert.equal(result.data.passed, true, `test o'tmadi: ${result.data.score}%`);

  // Server endi quizPassed=true deyishi kerak
  const afterQuiz = await api.get('/api/topics/current');
  assert.equal(afterQuiz.data.quizPassed, true);

  // 2) Test o'tildi, lekin so'zlar saqlanmagan — yakunlash rad etilishi kerak
  const tooEarly = await api.post('/api/topics/finish', {});
  assert.equal(tooEarly.status, 400);
  assert.equal(tooEarly.data.code, 'WORDS_REQUIRED');

  // 3) So'zlarni saqlash
  for (const w of words) {
    const added = await api.post('/api/words', {
      word: w.word,
      skipAI: true,
      fromTopic: true,
      manualTranslation: w.translation,
      manualDefinition: w.definition,
    });
    assert.ok([201, 400].includes(added.status), `so'z qo'shilmadi: ${JSON.stringify(added.data)}`);
  }

  // 4) Endi yakunlanishi kerak
  const finish = await api.post('/api/topics/finish', {});
  assert.equal(finish.status, 200, JSON.stringify(finish.data));
  assert.equal(finish.data.topicCompleted, true);
  assert.ok(finish.data.user.xp > 0, 'XP berilmadi');
  assert.equal(finish.data.user.dailyQuests.topicCompleted, true);

  // 5) Saqlangan so'zlar darhol takrorlash navbatida bo'lishi kerak
  const due = await api.get('/api/review/due');
  assert.ok(due.data.length >= words.length, `takrorlash navbati bo'sh: ${due.data.length}`);
});

test('kunlik reja 3 qadami tugagach streak boshlanadi', async () => {
  const api = makeClient();
  await api.register();

  const before = await api.get('/api/auth/me');
  assert.equal(before.data.currentStreak, 0);

  await api.post('/api/auth/sync-quest', { type: 'topic' });
  await api.post('/api/auth/sync-quest', { type: 'review' });
  const last = await api.post('/api/auth/sync-quest', { type: 'immersion' });

  assert.equal(last.status, 200);
  assert.equal(last.data.streakUpdated, true, 'streak yangilanmadi');
  assert.equal(last.data.user.currentStreak, 1);
  assert.ok(last.data.xpAwarded > 0);

  // Ikkinchi marta chaqirilsa streak ikki marta oshmasligi kerak
  const again = await api.post('/api/auth/sync-quest', { type: 'immersion' });
  assert.equal(again.data.user.currentStreak, 1, 'streak takroriy oshdi');
  assert.equal(again.data.streakUpdated, false);
});

test('streak muzlatish mavjud va profilda ko\'rinadi', async () => {
  const api = makeClient();
  await api.register();
  const me = await api.get('/api/auth/me');
  assert.equal(me.data.streakFreezesLeft, 2, 'boshlang\'ich muzlatishlar berilmadi');
  assert.ok(me.data.timezone, 'timezone maydoni yo\'q');
  assert.ok(me.data.today, 'today (foydalanuvchi zonasidagi kun) yo\'q');
});

test('takrorlash statistikasi to\'g\'ri hisoblanadi', async () => {
  const api = makeClient();
  await api.register();

  await api.post('/api/words', { word: 'mountain', skipAI: true, manualTranslation: 'tog\'' });
  await api.post('/api/words', { word: 'valley', skipAI: true, manualTranslation: 'vodiy' });

  const stats = await api.get('/api/review/stats');
  assert.equal(stats.status, 200);
  assert.equal(stats.data.total, 2);
  assert.equal(stats.data.due, 2, 'yangi so\'zlar darhol takrorlashda bo\'lishi kerak');
  assert.equal(stats.data.struggling, 0);
});

test('challenge real kontentdan keladi, shablon emas', async () => {
  const api = makeClient();
  await api.register();

  const res = await api.get('/api/challenge/current');
  assert.equal(res.status, 200);
  assert.ok(res.data.text.length > 50);
  assert.ok(Array.isArray(res.data.lines) && res.data.lines.length >= 4, 'qatorlar yo\'q');
  assert.ok(res.data.focusWords?.length > 0);
  assert.ok(res.data.totalDays > 0);

  // Eski shablon matni qaytmasligi kerak
  assert.ok(
    !res.data.text.includes('Welcome to day'),
    'eski shablon matni qaytdi'
  );
  assert.ok(
    !res.data.text.includes('Target words will be dynamically injected'),
    'to\'ldirilmagan shablon qoldi'
  );
});

test('olib tashlangan yo\'llar endi mavjud emas', async () => {
  const api = makeClient();
  await api.register();

  // /translate-text olib tashlandi — umumiy tarjimon o'rganish funksiyasi emas edi
  const removed = await api.post('/api/speaking/translate-text', {
    text: 'salom',
    from: 'Uzbek',
    to: 'English',
  });
  assert.equal(removed.status, 404);

  // Payme/Click stub'lari ham olib tashlandi
  assert.equal((await api.post('/api/billing/payme/checkout', {})).status, 404);
});
