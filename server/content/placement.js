/**
 * Daraja aniqlash testi (placement).
 *
 * Nega kerak: hozirgacha foydalanuvchi darajasini O'ZI tanlardi
 * (beginner/intermediate/advanced). O'z-o'zini baholash til o'rganishda eng
 * ishonchsiz signal — ko'pchilik o'zini past baholaydi, bir qismi aksincha.
 * Bundan tashqari tanlangan daraja kontentga umuman ta'sir qilmasdi:
 * `BEGINNER_DAY_SEQUENCE` [1..31] ayniyat edi, ya'ni hamma 1-kundan boshlardi.
 *
 * Algoritm ataylab sodda va tushuntirib beriladigan: har darajada 3 ta savol,
 * A2 dan boshlanadi, 2/3 dan yuqori bo'lsa yuqoriga, past bo'lsa pastga.
 * Ko'pi bilan 12 savol — ~2 daqiqa.
 */

const LEVELS = ['A1', 'A2', 'B1', 'B2'];
const QUESTIONS_PER_LEVEL = 3;
const PASS_THRESHOLD = 2; // 3 tadan 2 tasi

/**
 * Savollar banki.
 * Har bir savol o'sha daraja uchun XOS bo'lgan bitta narsani tekshiradi —
 * "qiyin so'z" emas, balki shu darajada o'zlashtiriladigan tuzilma.
 */
const ITEMS = [
  // ── A1 ──────────────────────────────────────────────────────────────────
  { id: 'a1-1', cefr: 'A1', skill: 'to be', prompt: 'She ___ a doctor.', options: ['is', 'are', 'am', 'be'], correct: 0 },
  { id: 'a1-2', cefr: 'A1', skill: 'artikl', prompt: 'I have ___ apple.', options: ['a', 'an', 'the', '—'], correct: 1 },
  { id: 'a1-3', cefr: 'A1', skill: "ko'plik", prompt: 'There are three ___ in the room.', options: ['child', 'childs', 'children', 'childrens'], correct: 2 },
  { id: 'a1-4', cefr: 'A1', skill: 'present simple', prompt: 'He ___ to school every day.', options: ['go', 'goes', 'going', 'gone'], correct: 1 },
  { id: 'a1-5', cefr: 'A1', skill: 'predlog', prompt: 'The book is ___ the table.', options: ['on', 'at', 'to', 'of'], correct: 0 },
  { id: 'a1-6', cefr: 'A1', skill: 'leksika', prompt: '"Chanqagan" inglizchada:', options: ['hungry', 'thirsty', 'tired', 'angry'], correct: 1 },
  { id: 'a1-7', cefr: 'A1', skill: "so'roq", prompt: '___ is your name?', options: ['Who', 'Where', 'What', 'When'], correct: 2 },
  { id: 'a1-8', cefr: 'A1', skill: 'egalik', prompt: 'This is ___ car. (men)', options: ['I', 'me', 'my', 'mine'], correct: 2 },

  // ── A2 ──────────────────────────────────────────────────────────────────
  { id: 'a2-1', cefr: 'A2', skill: 'past simple', prompt: 'Yesterday I ___ to the market.', options: ['go', 'goed', 'went', 'gone'], correct: 2 },
  { id: 'a2-2', cefr: 'A2', skill: 'comparative', prompt: 'This bag is ___ than that one.', options: ['cheap', 'cheaper', 'cheapest', 'more cheap'], correct: 1 },
  { id: 'a2-3', cefr: 'A2', skill: 'going to', prompt: 'Look at the clouds! It ___ rain.', options: ['is going to', 'goes to', 'will be', 'going'], correct: 0 },
  { id: 'a2-4', cefr: 'A2', skill: 'sanaladigan', prompt: 'How ___ sugar do you want?', options: ['many', 'much', 'lot', 'few'], correct: 1 },
  { id: 'a2-5', cefr: 'A2', skill: 'present continuous', prompt: 'Be quiet — the baby ___.', options: ['sleeps', 'slept', 'is sleeping', 'sleep'], correct: 2 },
  { id: 'a2-6', cefr: 'A2', skill: 'modal', prompt: 'You ___ wear a seatbelt. It is the law.', options: ['can', 'must', 'may', 'could'], correct: 1 },
  { id: 'a2-7', cefr: 'A2', skill: 'some/any', prompt: 'There isn\'t ___ milk in the fridge.', options: ['some', 'any', 'no', 'much of'], correct: 1 },
  { id: 'a2-8', cefr: 'A2', skill: 'leksika', prompt: 'The train ___ at 9 o\'clock. (jo\'naydi)', options: ['arrives', 'leaves', 'waits', 'stops'], correct: 1 },

  // ── B1 ──────────────────────────────────────────────────────────────────
  { id: 'b1-1', cefr: 'B1', skill: 'present perfect', prompt: 'I ___ in this city since 2019.', options: ['live', 'lived', 'have lived', 'am living'], correct: 2 },
  { id: 'b1-2', cefr: 'B1', skill: '1-shart', prompt: 'If it rains tomorrow, we ___ at home.', options: ['stay', 'will stay', 'stayed', 'would stay'], correct: 1 },
  { id: 'b1-3', cefr: 'B1', skill: 'passive', prompt: 'The bridge ___ in 1995.', options: ['built', 'was built', 'has built', 'is building'], correct: 1 },
  { id: 'b1-4', cefr: 'B1', skill: 'relative clause', prompt: 'That is the man ___ helped me.', options: ['which', 'who', 'whose', 'whom'], correct: 1 },
  { id: 'b1-5', cefr: 'B1', skill: 'used to', prompt: 'I ___ smoke, but I stopped last year.', options: ['use to', 'used to', 'am used to', 'was used'], correct: 1 },
  { id: 'b1-6', cefr: 'B1', skill: 'gerund/infinitive', prompt: 'She avoided ___ him at the party.', options: ['to meet', 'meet', 'meeting', 'met'], correct: 2 },
  { id: 'b1-7', cefr: 'B1', skill: 'phrasal verb', prompt: 'I need to ___ this word in the dictionary.', options: ['look after', 'look up', 'look for', 'look at'], correct: 1 },
  { id: 'b1-8', cefr: 'B1', skill: 'reported speech', prompt: 'He said he ___ tired.', options: ['is', 'was', 'has been', 'will be'], correct: 1 },

  // ── B2 ──────────────────────────────────────────────────────────────────
  { id: 'b2-1', cefr: 'B2', skill: '3-shart', prompt: 'If I ___ earlier, I would have caught the train.', options: ['left', 'had left', 'have left', 'would leave'], correct: 1 },
  { id: 'b2-2', cefr: 'B2', skill: 'perfect modal', prompt: 'She isn\'t answering — she ___ have left already.', options: ['must', 'can', 'should', 'would'], correct: 0 },
  { id: 'b2-3', cefr: 'B2', skill: 'inversion', prompt: '___ had I arrived when the meeting started.', options: ['Hardly', 'Almost', 'Nearly', 'Rarely'], correct: 0 },
  { id: 'b2-4', cefr: 'B2', skill: 'kollokatsiya', prompt: 'The company decided to ___ a survey.', options: ['make', 'do', 'conduct', 'perform on'], correct: 2 },
  { id: 'b2-5', cefr: 'B2', skill: 'participle clause', prompt: '___ the report, she went home.', options: ['Having finished', 'Finish', 'To finish', 'Finished'], correct: 0 },
  { id: 'b2-6', cefr: 'B2', skill: 'nuans', prompt: 'His argument was ___ — nobody could disagree.', options: ['compelling', 'compulsory', 'competing', 'complacent'], correct: 0 },
  { id: 'b2-7', cefr: 'B2', skill: 'bog\'lovchi', prompt: 'The plan is expensive; ___, it may be our only option.', options: ['therefore', 'nevertheless', 'moreover', 'hence'], correct: 1 },
  { id: 'b2-8', cefr: 'B2', skill: 'wish', prompt: 'I wish I ___ more time yesterday.', options: ['have had', 'had had', 'would have', 'had'], correct: 1 },
];

const itemsByLevel = (cefr) => ITEMS.filter((i) => i.cefr === cefr);

const getItemById = (id) => ITEMS.find((i) => i.id === id) || null;

/**
 * Keyingi qadamni hisoblaydi. Sof funksiya — testda holat qurish oson.
 *
 * @param {Array<{cefr: string, correct: boolean}>} answers  berilgan javoblar
 * @returns {{ done: boolean, level?: string, nextLevel?: string, askedAtLevel?: number }}
 */
const nextStep = (answers) => {
  const byLevel = {};
  for (const level of LEVELS) {
    const forLevel = answers.filter((a) => a.cefr === level);
    byLevel[level] = {
      asked: forLevel.length,
      correct: forLevel.filter((a) => a.correct).length,
    };
  }

  // Hozir qaysi darajadamiz: oxirgi javob bergan daraja, yoki boshlanish A2
  const currentLevel = answers.length ? answers[answers.length - 1].cefr : 'A2';
  const stats = byLevel[currentLevel];

  // Shu darajada hali savollar qolgan
  if (stats.asked < QUESTIONS_PER_LEVEL) {
    return { done: false, nextLevel: currentLevel, askedAtLevel: stats.asked };
  }

  const passed = stats.correct >= PASS_THRESHOLD;
  const index = LEVELS.indexOf(currentLevel);

  if (passed) {
    const upper = LEVELS[index + 1];
    // Yuqori daraja yo'q yoki allaqachon sinalgan → shu daraja yakuniy
    if (!upper || byLevel[upper].asked >= QUESTIONS_PER_LEVEL) {
      return { done: true, level: currentLevel };
    }
    return { done: false, nextLevel: upper, askedAtLevel: 0 };
  }

  const lower = LEVELS[index - 1];
  // Pastki daraja yo'q (A1 da yiqildi) → A1
  if (!lower) {
    return { done: true, level: 'A1' };
  }
  // Pastki daraja allaqachon sinalgan → o'shanda o'tgan bo'lsa o'sha, aks holda eng past
  if (byLevel[lower].asked >= QUESTIONS_PER_LEVEL) {
    return {
      done: true,
      level: byLevel[lower].correct >= PASS_THRESHOLD ? lower : LEVELS[0],
    };
  }
  return { done: false, nextLevel: lower, askedAtLevel: 0 };
};

/** CEFR → ilovadagi onboarding darajasi */
const cefrToLearnerLevel = (cefr) => {
  if (cefr === 'B2') return 'advanced';
  if (cefr === 'B1') return 'intermediate';
  return 'beginner';
};

module.exports = {
  LEVELS,
  QUESTIONS_PER_LEVEL,
  PASS_THRESHOLD,
  ITEMS,
  itemsByLevel,
  getItemById,
  nextStep,
  cefrToLearnerLevel,
};
