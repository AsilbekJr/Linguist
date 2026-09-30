const Word = require('../../models/Word');

/**
 * Kunlik rejani HAQIQIY yo'l bilan bajarish uchun yordamchilar.
 *
 * Ilgari testlar `/auth/sync-quest` ga `{type}` yuborib qadamlarni yopardi —
 * ya'ni aynan mijozga ishonadigan teshikni "to'g'ri xatti-harakat" deb
 * mustahkamlardi. Endi qadamlar faqat ish bajarilganda yopiladi.
 */

/**
 * Mini-testdan o'tish va kunlik sahnani yakunlash.
 * So'zlar qo'lda saqlanmaydi — sahna yakunlanganda server ularni o'zi qo'shadi.
 */
const finishTopicDay = async (api) => {
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

  return api.post('/api/topics/finish', {});
};

/** Mahalliy tekshiruvdan o'tadigan gap */
const sentenceFor = (word) => `I think the word ${word} is very useful today.`;

/** So'zning to'liq ma'lumoti (navbatdagi ko'rinishda javob yashiriladi) */
const fullWord = async (wordId) => Word.findById(wordId).lean();

/** Rejimga mos TO'G'RI javob tanasi */
const correctBody = (mode, word) => {
  if (mode === 'recognize') return { mode, answer: word.translation };
  if (mode === 'recall' || mode === 'cloze') return { mode, answer: word.word };
  if (mode === 'build') return { mode, answer: word.examples[0] };
  return { mode: 'sentence', sentence: sentenceFor(word.word) };
};

/** Navbatdagi bitta so'zga uning rejimida to'g'ri javob berish */
const answerDue = async (api, dueItem) => {
  const word = await fullWord(dueItem._id);
  return api.post(`/api/review/${dueItem._id}/check`, correctBody(dueItem.mode, word));
};

/** Navbatdagi barcha so'zlarni to'g'ri takrorlash; oxirgi javobni qaytaradi */
const reviewAllDue = async (api) => {
  let last = null;
  for (let guard = 0; guard < 10; guard++) {
    const due = await api.get('/api/review/due');
    if (!due.data.length) break;
    for (const item of due.data) {
      last = await answerDue(api, item);
    }
  }
  return last;
};

/** So'zni hozir takrorlanadigan qilish — kunlar o'tishini simulyatsiya qiladi */
const makeDue = (wordId) =>
  Word.updateOne({ _id: wordId }, { $set: { nextReviewDate: new Date(Date.now() - 1000) } });

/** So'zni kerakli bosqichga qo'yish (masalan gap tuzish rejimini sinash uchun — 4+) */
const setStage = (wordId, stage) =>
  Word.updateOne({ _id: wordId }, { $set: { stage, nextReviewDate: new Date(Date.now() - 1000) } });

/**
 * Erkin gap rejimini sinash uchun: yuqori daraja (5-bosqichdan gap) va 5-bosqich.
 * Boshlovchi va o'rta darajada 4-5-bosqichlar — bo'sh joy va gap yig'ish.
 */
const useSentenceMode = async (api, wordId) => {
  await api.patch('/api/auth/profile', { level: 'advanced' });
  await setStage(wordId, 5);
};

module.exports = { finishTopicDay, reviewAllDue, answerDue, correctBody, sentenceFor, makeDue, setStage, useSentenceMode, fullWord };
