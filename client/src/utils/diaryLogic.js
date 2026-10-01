/**
 * Ovoz kundaligi — sof mantiq (IndexedDB va brauzersiz, test qilinadi).
 *
 * Ikki xil yozuv:
 *  - `story` — "Mening hikoyam": har 7 kunda bir xil savollar bo'yicha
 *    30 soniya. Savollar bir xil bo'lgani uchun "1-kun va bugun"ni
 *    solishtirish ma'noli: odam o'z o'sishini o'z qulog'i bilan eshitadi.
 *  - `phrase` — Suhbatdan keyin bugungi eng yaxshi gap (ixtiyoriy, 10 s).
 */

export const STORY_INTERVAL_DAYS = 7;
export const STORY_MAX_SECONDS = 45;
export const PHRASE_MAX_SECONDS = 12;
/** Kunlik iboralar shuncha saqlanadi; hikoyalar — hammasi (ular kam va qimmatli) */
export const PHRASE_KEEP = 60;

export const STORY_PROMPT = {
  uz: "O'zingiz haqingizda gapiring. Har safar shu savollar — shunda o'sishingiz eshitiladi.",
  questions: [
    'What is your name and where are you from?',
    'What do you do every day?',
    'Why are you learning English?',
    'What did you do last weekend?',
  ],
};

/** 'YYYY-MM-DD' kalitlari orasidagi kunlar (b - a) */
export const daysBetween = (a, b) => {
  const toUtc = (k) => {
    const [y, m, d] = String(k).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86400000);
};

const byDate = (a, b) => (a.dayKey < b.dayKey ? -1 : a.dayKey > b.dayKey ? 1 : a.createdAt - b.createdAt);

export const storiesOf = (entries = []) => entries.filter((e) => e.kind === 'story').sort(byDate);

/** Hikoya yozish vaqti keldimi: hali yo'q yoki oxirgisidan 7+ kun o'tgan */
export const isStoryDue = (entries, todayKey) => {
  const stories = storiesOf(entries);
  if (!stories.length) return true;
  return daysBetween(stories[stories.length - 1].dayKey, todayKey) >= STORY_INTERVAL_DAYS;
};

/** Keyingi hikoyagacha necha kun (0 — bugun) */
export const daysUntilNextStory = (entries, todayKey) => {
  const stories = storiesOf(entries);
  if (!stories.length) return 0;
  return Math.max(0, STORY_INTERVAL_DAYS - daysBetween(stories[stories.length - 1].dayKey, todayKey));
};

/** "1-kun va bugun": birinchi va oxirgi hikoya (kamida 2 ta, turli kunlarda) */
export const pickComparison = (entries) => {
  const stories = storiesOf(entries);
  if (stories.length < 2) return null;
  const first = stories[0];
  const last = stories[stories.length - 1];
  if (first.dayKey === last.dayKey) return null;
  return { first, last, days: daysBetween(first.dayKey, last.dayKey) };
};

/** Kundalik boshlangan kundan nechanchi kun ("1-kun") */
export const dayLabel = (entries, dayKey) => {
  const all = [...entries].sort(byDate);
  if (!all.length) return '1-kun';
  return `${daysBetween(all[0].dayKey, dayKey) + 1}-kun`;
};

/** O'chiriladigan yozuvlar id'lari: hikoyalar qoladi, iboralardan eng yangi 60 tasi */
export const entriesToPrune = (entries) => {
  const phrases = entries.filter((e) => e.kind === 'phrase').sort(byDate);
  return phrases.slice(0, Math.max(0, phrases.length - PHRASE_KEEP)).map((e) => e.id);
};
