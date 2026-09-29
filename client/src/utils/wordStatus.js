const DAY = 86400000;

/** Yodlangan so'z — yangi `learned` yoki eski `mastered` maydoni */
export const isLearned = (word) => Boolean(word?.learned ?? word?.mastered);

/** Hozir takrorlanishi kerakmi (server `dueFilter` bilan bir xil mantiq) */
export const isDue = (word, now = Date.now()) => {
  if (isLearned(word)) return false;
  const next = word?.nextReviewDate ? new Date(word.nextReviewDate).getTime() : 0;
  return !next || next <= now;
};

/** Keyingi takrorlash qachonligi — foydalanuvchi tilida */
export const reviewStatus = (word, now = Date.now()) => {
  if (isLearned(word)) return { key: 'learned', label: 'Yodlangan', tone: 'success' };
  if (isDue(word, now)) return { key: 'due', label: 'Bugun takrorlanadi', tone: 'warning' };
  const next = new Date(word.nextReviewDate).getTime();
  const days = Math.max(1, Math.ceil((next - now) / DAY));
  return { key: 'scheduled', label: days === 1 ? 'Ertaga' : `${days} kundan keyin`, tone: 'muted' };
};
