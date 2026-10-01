/**
 * "Yod olish" — gapni qo'shiq matni kabi yodlash (bosqichma-bosqich yo'qolish).
 *
 * Har davrada gapning ko'proq qismi yashiriladi, talaba esa uni har safar
 * ovoz chiqarib aytadi. Aktyorlar rol matnini shunday yodlaydi: so'z alohida
 * emas, ohangi va grammatikasi bilan birga eslab qolinadi.
 *
 *   1 — to'liq gap (eshitib takrorlash)
 *   2 — bugungi so'zlar va har ikkinchi mazmunli so'z yashirin
 *   3 — faqat har so'zning birinchi harfi
 *   4 — faqat o'zbekcha ma'nosi
 */

export const ROUNDS = [
  { round: 1, title: 'Eshiting va takrorlang', hint: "Gapni tinglang va xuddi shunday ohangda ovoz chiqarib ayting." },
  { round: 2, title: "Bo'shliqlarni to'ldirib ayting", hint: "Yashiringan so'zlarni eslab, butun gapni ayting." },
  { round: 3, title: 'Birinchi harflar bilan', hint: "Faqat birinchi harflar qoldi — gapni to'liq ayting." },
  { round: 4, title: 'Yoddan', hint: "Faqat ma'nosi ko'rinadi. Inglizchasini yoddan ayting." },
];

export const MANDATORY_ROUNDS = 2;
export const LAST_ROUND = ROUNDS.length;

/** "prescription?" → ["", "prescription", "?"] */
const splitToken = (token) => {
  const m = String(token).match(/^([^A-Za-z0-9’']*)([A-Za-z0-9’'-]*)(.*)$/);
  return m ? [m[1], m[2], m[3]] : ['', token, ''];
};

const norm = (s) => String(s || '').toLowerCase().replace(/’/g, "'");

/** So'z bugungi so'zlardan birimi (oddiy shakllar bilan: symptom → symptoms) */
const isTargetWord = (core, targets) => {
  const w = norm(core);
  if (!w) return false;
  return targets.some((t) => {
    const parts = norm(t).split(/\s+/);
    return parts.some((p) => p.length > 1 && (w === p || (p.length >= 4 && w.startsWith(p))));
  });
};

const blank = (core) => '_'.repeat(Math.min(Math.max(core.length, 3), 10));

/**
 * @param {string} text  inglizcha gap
 * @param {number} round 1-4
 * @param {string[]} targets bugungi so'zlar
 * @returns {Array<{ text: string, hidden: boolean }>} ko'rsatiladigan bo'laklar
 */
export const maskLine = (text, round, targets = []) => {
  const tokens = String(text || '').split(/\s+/).filter(Boolean);
  if (round <= 1) return tokens.map((t) => ({ text: t, hidden: false }));
  if (round >= LAST_ROUND) return tokens.map((t) => ({ text: blank(splitToken(t)[1]), hidden: true }));

  if (round === 3) {
    return tokens.map((t) => {
      const [pre, core, post] = splitToken(t);
      if (core.length <= 1) return { text: t, hidden: false };
      return { text: `${pre}${core[0]}${'_'.repeat(Math.min(core.length - 1, 9))}${post}`, hidden: true };
    });
  }

  // 2-davra: bugungi so'zlar + har ikkinchi mazmunli (4+ harfli) so'z
  let contentSeen = 0;
  const parts = tokens.map((t) => {
    const [pre, core, post] = splitToken(t);
    let hide = isTargetWord(core, targets);
    if (!hide && core.length >= 4) {
      contentSeen += 1;
      hide = contentSeen % 2 === 0;
    }
    return hide ? { text: `${pre}${blank(core)}${post}`, hidden: true } : { text: t, hidden: false };
  });
  // Hech bo'lmasa bitta so'z yashirilsin — aks holda davra 1-davradan farq qilmaydi
  if (!parts.some((p) => p.hidden)) {
    const longest = tokens.reduce((best, t, i) => (splitToken(t)[1].length > splitToken(tokens[best])[1].length ? i : best), 0);
    const [pre, core, post] = splitToken(tokens[longest]);
    parts[longest] = { text: `${pre}${blank(core)}${post}`, hidden: true };
  }
  return parts;
};
