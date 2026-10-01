const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, makeClient } = require('./helpers/testServer');
const { finishTopicDay, reviewAllDue, setStage } = require('./helpers/dailyFlow');

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

test('profil XP o\'rniga yodlangan so\'zlar va CEFR yo\'lini qaytaradi', async () => {
  const { computeCourseProgress } = require('../utils/topicsData');
  const list = [
    { day: 1, cefr: 'A1' }, { day: 2, cefr: 'A1' },
    { day: 3, cefr: 'A2' }, { day: 4, cefr: 'A2' }, { day: 5, cefr: 'A2' },
  ];
  assert.deepEqual(computeCourseProgress(list, 4), {
    cefr: 'A2', nextCefr: null, done: 1, total: 3, percent: 33, daysCompleted: 3, totalDays: 5, finished: false,
  });
  assert.equal(computeCourseProgress(list, 1).nextCefr, 'A2');
  assert.equal(computeCourseProgress(list, 6).finished, true);
  assert.equal(computeCourseProgress(list, 6).percent, 100);

  const api = makeClient();
  await api.register();
  const me = await api.get('/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.knownWords, 0);
  assert.equal(me.data.totalWords, 0);
  assert.ok(me.data.course?.cefr, "course.cefr yo'q");
  assert.equal(me.data.course.daysCompleted, 0);
});

test('reja kunlik yangi so\'zlar sonini belgilaydi', async () => {
  const { getDailyWordTarget } = require('../utils/gamification');
  assert.equal(getDailyWordTarget({ planType: 'sprint', level: 'advanced' }), 5);
  assert.equal(getDailyWordTarget({ planType: 'fluency' }), 10);
  // Eski 'standard' reja — darajaga qarab
  assert.equal(getDailyWordTarget({ planType: 'standard', level: 'intermediate' }), 5);
  assert.equal(getDailyWordTarget(undefined), 3);

  const api = makeClient();
  await api.register();

  const setPlan = async (planType) => {
    const res = await api.patch('/api/auth/profile', { planType });
    assert.equal(res.status, 200, JSON.stringify(res.data));
    return res.data;
  };

  const sprint = await setPlan('sprint');
  assert.equal(sprint.dailyWordTarget, 5);
  let today = await api.get('/api/topics/current');
  assert.equal(today.data.wordTarget, 5);
  assert.equal(today.data.words.length, 5);

  await setPlan('fluency');
  today = await api.get('/api/topics/current');
  assert.equal(today.data.wordTarget, 10);
  assert.equal(today.data.words.length, Math.min(10, today.data.totalWordsInTopic));
});

test('to\'liq kunlik oqim: test → yakunlash → so\'zlar avtomatik lug\'atda', async () => {
  const api = makeClient();
  await api.register();

  const topic = await api.get('/api/topics/current');
  const words = topic.data.words;
  assert.ok(words.length > 0);

  // 1) Testsiz yakunlab bo'lmaydi
  const tooEarly = await api.post('/api/topics/finish', {});
  assert.equal(tooEarly.status, 400);
  assert.equal(tooEarly.data.code, 'QUIZ_REQUIRED');

  // 2) Testni o'tish
  const { result } = await passQuizAndFinish(api);
  assert.equal(result.data.passed, true, `test o'tmadi: ${result.data.score}%`);
  const afterQuiz = await api.get('/api/topics/current');
  assert.equal(afterQuiz.data.quizPassed, true);

  // 3) So'zlarni qo'lda saqlamasdan yakunlash — ilgari WORDS_REQUIRED bilan rad etilardi
  const finish = await api.post('/api/topics/finish', {});
  assert.equal(finish.status, 200, JSON.stringify(finish.data));
  assert.equal(finish.data.topicCompleted, true);
  assert.equal(finish.data.wordsAdded, words.length, "kun so'zlari avtomatik qo'shilmadi");
  assert.ok(finish.data.user.xp > 0, 'XP berilmadi');

  // 4) So'zlar lug'atda, to'liq ma'lumot bilan
  const dict = await api.get('/api/words');
  for (const w of words) {
    const saved = dict.data.find((d) => d.word.toLowerCase() === w.word.toLowerCase());
    assert.ok(saved, `"${w.word}" lug'atga qo'shilmadi`);
    assert.equal(saved.translation, w.translation);
    assert.ok(saved.definition && saved.examples?.length, `"${w.word}" ma'lumoti to'liq emas`);
  }

  // 5) Va darhol takrorlash navbatida — birinchi bosqich: tanib olish
  const due = await api.get('/api/review/due');
  assert.ok(due.data.length >= words.length, `takrorlash navbati bo'sh: ${due.data.length}`);
  assert.ok(due.data.every((d) => d.mode === 'recognize'), "yangi so'zlar tanib olishdan boshlanishi kerak");
});

test("takrorlash rejimlari: javob oshkor qilinmaydi, mijoz rejimni tanlay olmaydi", async () => {
  const api = makeClient();
  await api.register();
  const added = await api.post('/api/words', {
    word: 'journey',
    skipAI: true,
    manualTranslation: 'sayohat',
    manualDefinition: 'a trip from one place to another',
    manualExamples: ['Our journey took two days.'],
  });
  const id = added.data._id;

  // Tanib olish: tarjima ko'rinmaydi, lekin variantlar orasida bor
  let due = (await api.get('/api/review/due')).data.find((w) => w._id === id);
  assert.equal(due.mode, 'recognize');
  assert.equal(due.translation, undefined, 'tanib olishda tarjima oshkor qilinmasligi kerak');
  assert.equal(due.options.length, 4);
  assert.ok(due.options.includes('sayohat'));
  assert.equal(new Set(due.options).size, 4, 'variantlar takrorlanmasligi kerak');

  // Osonroq/boshqa rejimni tanlab bo'lmaydi
  const cheat = await api.post(`/api/review/${id}/check`, { mode: 'sentence', sentence: 'My journey was long.' });
  assert.equal(cheat.status, 409);
  assert.equal(cheat.data.code, 'MODE_MISMATCH');

  const wrong = await api.post(`/api/review/${id}/check`, { mode: 'recognize', answer: 'uy' });
  assert.equal(wrong.data.isCorrect, false);
  assert.equal(wrong.data.correctAnswer, 'sayohat');
  assert.equal(wrong.data.reveal.word.toLowerCase(), 'journey', 'javobdan keyin kartochka ochilishi kerak');

  // Eslash: so'zning o'zi ko'rinmaydi, misolda yashirilgan
  await setStage(id, 2);
  due = (await api.get('/api/review/due')).data.find((w) => w._id === id);
  assert.equal(due.mode, 'recall');
  assert.equal(due.word, undefined, "eslashda so'zning o'zi oshkor qilinmasligi kerak");
  assert.equal(due.translation, 'sayohat');
  assert.ok(!/journey/i.test(due.exampleMasked), 'misolda so\'z yashirilishi kerak');
  assert.equal(due.hint.firstLetter, 'j');

  // Bitta harf xatosi uzun so'zda kechiriladi
  const near = await api.post(`/api/review/${id}/check`, { mode: 'recall', answer: 'journy' });
  assert.equal(near.data.isCorrect, true);
  assert.equal(near.data.nearMiss, true);
  assert.equal(near.data.stage, 3);
  assert.equal(near.data.nextMode, 'recall');
});

test("tanib olish va eslash AI limitini yemaydi", async () => {
  const api = makeClient();
  await api.register();
  const added = await api.post('/api/words', { word: 'bridge', skipAI: true, manualTranslation: "ko'prik" });

  const before = (await api.get('/api/billing/subscription')).data.usage?.aiCallsToday || 0;
  const res = await api.post(`/api/review/${added.data._id}/check`, { mode: 'recognize', answer: "ko'prik" });
  assert.equal(res.data.isCorrect, true);
  assert.equal(res.data.method, 'exact');
  const after = (await api.get('/api/billing/subscription')).data.usage?.aiCallsToday || 0;
  assert.equal(after, before, 'AI kerak bo\'lmagan rejim limitdan hisoblanmasligi kerak');
});

test('sahna → takrorlash: navbat bo\'shaganda streak boshlanadi', async () => {
  const api = makeClient();
  await api.register();

  const before = await api.get('/api/auth/me');
  assert.equal(before.data.currentStreak, 0);

  const finish = await finishTopicDay(api);
  assert.equal(finish.status, 200, JSON.stringify(finish.data));
  // Sahna so'zlari endi navbatda — takrorlash hali qilinmagan
  assert.equal(finish.data.streakUpdated, false);

  const last = await reviewAllDue(api);
  assert.equal(last.status, 200);
  assert.equal(last.data.dailyStep.reviewCompleted, true, 'navbat bo\'shadi, qadam yopilmadi');
  assert.equal(last.data.dailyStep.reviewSkipped, false, "haqiqatan takrorladi — \"o'tkazildi\" emas");
  assert.equal(last.data.dailyStep.streakUpdated, true, 'streak yangilanmadi');
  assert.equal(last.data.dailyStep.currentStreak, 1);

  const me = await api.get('/api/auth/me');
  assert.equal(me.data.currentStreak, 1);

  // Qayta chaqirilsa streak ikki marta oshmasligi kerak
  const again = await api.post('/api/review/complete-day');
  assert.equal(again.status, 200);
  assert.equal(again.data.streakUpdated, false);
  assert.equal(again.data.currentStreak, 1, 'streak takroriy oshdi');
});

test('takrorlash → sahna tartibida ham streak oshadi', async () => {
  // Ilgari streak faqat sync-quest'da oshardi, /topics/finish esa uni
  // chaqirmasdi — bu tartibda streak o'sha kuni umuman oshmasdi.
  const api = makeClient();
  await api.register();

  // Navbat bo'sh — takrorlash qadami server tekshiruvi bilan yopiladi
  const review = await api.post('/api/review/complete-day');
  assert.equal(review.status, 200, JSON.stringify(review.data));
  assert.equal(review.data.reviewCompleted, true);
  assert.equal(review.data.streakUpdated, false, 'sahnasiz streak oshmasligi kerak');
  // Takrorlanadigan so'z yo'q edi: qadam "o'tkazildi" — XP va "bajarildi" xabari yo'q
  assert.equal(review.data.reviewSkipped, true);
  assert.equal(review.data.xpAwarded, 0, 'hech narsa takrorlamay XP berildi');
  assert.equal(review.data.message, null, '"Qadam bajarildi!" xabari chiqmasligi kerak');

  const finish = await finishTopicDay(api);
  assert.equal(finish.status, 200, JSON.stringify(finish.data));
  assert.equal(finish.data.streakUpdated, true, 'sahna tugaganda streak oshmadi');
  assert.equal(finish.data.user.currentStreak, 1);
});

test('kunlik reja qadamlarini mijoz o\'zi yopa olmaydi', async () => {
  const api = makeClient();
  await api.register();

  // Eski teshik: ikki so'rov bilan XP va streak
  assert.equal((await api.post('/api/auth/sync-quest', { type: 'topic' })).status, 404);

  // Navbatda so'z bor ekan, takrorlash qadamini yopib bo'lmaydi
  await api.post('/api/words', { word: 'mountain', skipAI: true, manualTranslation: 'tog\'' });
  const early = await api.post('/api/review/complete-day');
  assert.equal(early.status, 409);
  assert.equal(early.data.code, 'REVIEW_PENDING');

  const me = await api.get('/api/auth/me');
  assert.equal(me.data.xp, 0, 'hech narsa qilmasdan XP berildi');
});

test('muddati kelmagan so\'z mashq rejimida — bosqich o\'zgarmaydi', async () => {
  const api = makeClient();
  await api.register();

  const added = await api.post('/api/words', { word: 'bridge', skipAI: true, manualTranslation: 'ko\'prik' });
  const id = added.data._id;

  const miss = await api.post(`/api/review/${id}/check`, { mode: 'recognize', answer: 'daryo' });
  assert.equal(miss.data.practice, false);
  assert.equal(miss.data.stage, 1);

  // "Qayta urinish": ilgari bu so'zni o'sha zahoti 2-bosqichga ko'tarardi
  const retry = await api.post(`/api/review/${id}/check`, { mode: 'recognize', answer: "ko'prik" });
  assert.equal(retry.status, 200);
  assert.equal(retry.data.practice, true);
  assert.equal(retry.data.isCorrect, true, 'mashqda ham fikr-mulohaza beriladi');
  assert.equal(retry.data.stage, 1, 'mashq bosqichni oshirmasligi kerak');

  // 7 marta ketma-ket yuborib "yodlangan" qilib bo'lmaydi
  for (let i = 0; i < 7; i++) {
    await api.post(`/api/review/${id}/check`, { mode: 'recognize', answer: "ko'prik" });
  }
  const words = await api.get('/api/words');
  const w = words.data.find((x) => x._id === id);
  assert.equal(w.learned, false);
  assert.equal(w.stage, 1);
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

  // Gapirish va challenge kunlik sahnaga ko'chdi — alohida endpoint'lar yo'q
  assert.equal((await api.post('/api/speaking/translate', { text: 'salom' })).status, 404);
  assert.equal((await api.get('/api/challenge/current')).status, 404);

  // Ikki tarif: Premium endi sotilmaydi
  assert.equal((await api.post('/api/billing/checkout', { plan: 'premium' })).status, 400);
});
