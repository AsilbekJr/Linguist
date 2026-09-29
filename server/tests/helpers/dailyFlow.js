const Word = require('../../models/Word');

/**
 * Kunlik rejani HAQIQIY yo'l bilan bajarish uchun yordamchilar.
 *
 * Ilgari testlar `/auth/sync-quest` ga `{type}` yuborib qadamlarni yopardi —
 * ya'ni aynan mijozga ishonadigan teshikni "to'g'ri xatti-harakat" deb
 * mustahkamlardi. Endi qadamlar faqat ish bajarilganda yopiladi.
 */

/** Mini-testdan o'tish, so'zlarni saqlash va kunlik sahnani yakunlash */
const finishTopicDay = async (api) => {
  const topic = await api.get('/api/topics/current');
  const words = topic.data.words;

  const quiz = await api.post('/api/topics/quiz/start');
  const n = quiz.data.questions.length;
  const probe = await api.post('/api/topics/quiz/submit', {
    quizId: quiz.data.quizId,
    answers: Array(n).fill(0),
  });
  const answers = quiz.data.questions.map((q, i) =>
    q.options.indexOf(probe.data.results[i].correctAnswer)
  );
  await api.post('/api/topics/quiz/submit', { quizId: quiz.data.quizId, answers });

  for (const w of words) {
    await api.post('/api/words', {
      word: w.word,
      skipAI: true,
      fromTopic: true,
      manualTranslation: w.translation,
      manualDefinition: w.definition,
    });
  }

  return api.post('/api/topics/finish', {});
};

/** Mahalliy tekshiruvdan o'tadigan gap */
const sentenceFor = (word) => `I think the word ${word} is very useful today.`;

/** Navbatdagi barcha so'zlarni to'g'ri takrorlash; oxirgi javobni qaytaradi */
const reviewAllDue = async (api) => {
  let last = null;
  for (let guard = 0; guard < 10; guard++) {
    const due = await api.get('/api/review/due');
    if (!due.data.length) break;
    for (const w of due.data) {
      last = await api.post(`/api/review/${w._id}/check`, { sentence: sentenceFor(w.word) });
    }
  }
  return last;
};

/** So'zni hozir takrorlanadigan qilish — kunlar o'tishini simulyatsiya qiladi */
const makeDue = (wordId) =>
  Word.updateOne({ _id: wordId }, { $set: { nextReviewDate: new Date(Date.now() - 1000) } });

module.exports = { finishTopicDay, reviewAllDue, sentenceFor, makeDue };
