const test = require('node:test');
const assert = require('node:assert/strict');
const { start, stop, makeClient } = require('./helpers/testServer');
const { finishTopicDay, reviewAllDue } = require('./helpers/dailyFlow');

/**
 * Ibora kartalari: sahnada yodlangan kalit gaplar ertasi kuni takrorlashga
 * qaytadi — o'zbekcha ma'nodan butun gapni aytish.
 */

test.before(async () => {
  await start();
});
test.after(async () => {
  await stop();
});

const User = require('../models/User');
const Phrase = require('../models/Phrase');
const Word = require('../models/Word');
const { matchPhrase } = require('../utils/phraseMatch');
const { addScenePhrases } = require('../services/phrases');

const sceneUser = async () => {
  const api = makeClient();
  await api.register();
  const finish = await finishTopicDay(api);
  assert.equal(finish.status, 200, JSON.stringify(finish.data));
  const me = await api.get('/api/auth/me');
  return { api, userId: me.data._id };
};

const makePhrasesDue = (userId) =>
  Phrase.updateMany({ user: userId }, { $set: { nextReviewDate: new Date(Date.now() - 1000) } });

test("sahna yakunlanganda kalit gaplar ERTANGI takrorlashga qo'shiladi", async () => {
  const { api, userId } = await sceneUser();
  const list = await Phrase.find({ user: userId }).lean();
  assert.ok(list.length >= 3 && list.length <= 5, `${list.length} ta ibora`);
  assert.ok(list.every((p) => p.nextReviewDate > new Date()), 'bugun emas, ertaga');

  const due = await api.get('/api/review/phrases/due');
  assert.equal(due.status, 200);
  assert.equal(due.data.length, 0);
});

test('navbatda javob oshkor qilinmaydi: faqat ma\'nosi va birinchi harflar', async () => {
  const { api, userId } = await sceneUser();
  await makePhrasesDue(userId);
  const due = await api.get('/api/review/phrases/due');
  assert.ok(due.data.length > 0);
  const card = due.data[0];
  const stored = await Phrase.findById(card._id).lean();
  assert.equal(card.text, undefined, 'inglizcha gap yuborilmasligi kerak');
  assert.ok(card.textUz);
  assert.notEqual(card.hint, stored.text);
  assert.equal(card.hint[0], stored.text[0]);
});

test("to'g'ri aytilsa bosqich oshadi, xato bo'lsa ertaga qaytadi", async () => {
  const { api, userId } = await sceneUser();
  await makePhrasesDue(userId);
  const [a, b] = (await api.get('/api/review/phrases/due')).data;
  const textA = (await Phrase.findById(a._id).lean()).text;

  const ok = await api.post(`/api/review/phrases/${a._id}/check`, { answer: textA.toLowerCase().replace(/[.,!?]/g, ''), source: 'voice' });
  assert.equal(ok.status, 200, JSON.stringify(ok.data));
  assert.equal(ok.data.isCorrect, true);
  assert.equal(ok.data.stage, 1);
  assert.ok(new Date(ok.data.nextReviewDate) > new Date());

  const bad = await api.post(`/api/review/phrases/${b._id}/check`, { answer: 'completely different words here' });
  assert.equal(bad.data.isCorrect, false);
  assert.equal(bad.data.stage, 0);
  assert.ok(bad.data.words.some((w) => !w.hit), 'tushib qolgan so\'zlar belgilanadi');
  assert.equal((await Phrase.findById(b._id).lean()).lapses, 1);

  // Endi muddati kelmagan — mashq: jadval o'zgarmaydi
  const again = await api.post(`/api/review/phrases/${a._id}/check`, { answer: textA });
  assert.equal(again.data.practice, true);
  assert.equal(again.data.stage, 1);
});

test('"Takrorlash" qadami iboralar ham tugaganda yopiladi', async () => {
  const { api, userId } = await sceneUser();
  // So'zlarni takrorlab bo'lamiz — iboralar hali muddati kelmagan, qadam yopiladi
  await reviewAllDue(api);
  // Ertangi holat: so'z yo'q, faqat iboralar
  await User.updateOne({ _id: userId }, { $set: { 'dailyQuests.date': '2000-01-01' } });
  await Word.updateMany({ user: userId }, { $set: { nextReviewDate: new Date(Date.now() + 86400000 * 5) } });
  await makePhrasesDue(userId);

  const early = await api.post('/api/review/complete-day');
  assert.equal(early.status, 409, 'iboralar turganda qadam yopilmasligi kerak');

  const due = (await api.get('/api/review/phrases/due')).data;
  let last = null;
  for (const card of due) {
    const text = (await Phrase.findById(card._id).lean()).text;
    last = await api.post(`/api/review/phrases/${card._id}/check`, { answer: text });
  }
  assert.equal(last.data.dailyStep.reviewCompleted, true);
  assert.equal(last.data.dailyStep.reviewSkipped, false);
});

test("boshqa foydalanuvchining iborasiga tegib bo'lmaydi", async () => {
  const { userId } = await sceneUser();
  const phrase = await Phrase.findOne({ user: userId }).lean();
  const stranger = makeClient();
  await stranger.register();
  const res = await stranger.post(`/api/review/phrases/${phrase._id}/check`, { answer: phrase.text });
  assert.equal(res.status, 404);
});

test("bir xil ibora ikki marta qo'shilmaydi va jadvali buzilmaydi", async () => {
  const { userId } = await sceneUser();
  const user = await User.findById(userId);
  const before = await Phrase.find({ user: userId }).lean();
  await Phrase.updateOne({ _id: before[0]._id }, { $set: { stage: 3 } });
  const added = await addScenePhrases(user, before.map((p) => ({ en: p.text, uz: p.textUz })), 1);
  assert.equal(added, 0);
  assert.equal(await Phrase.countDocuments({ user: userId }), before.length);
  assert.equal((await Phrase.findById(before[0]._id).lean()).stage, 3);
});

test('solishtirish: qisqartmalar, tinish belgilari va tartib', () => {
  assert.equal(matchPhrase("No, you don't have to.", 'no you do not have to').percent, 100);
  assert.equal(matchPhrase('I need a prescription.', 'I need prescription').percent < 100, true);
  assert.ok(matchPhrase('How long have you had these symptoms?', 'how long have you had these symptoms').percent >= 80);
  assert.ok(matchPhrase('How long have you had these symptoms?', 'symptoms').percent < 80);
});
