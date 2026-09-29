/**
 * Aytilgan gapni maqsadli gap bilan so'zma-so'z solishtirish.
 *
 * Shadowing va "yoddan ayt" qadamlari uchun. AI chaqirilmaydi — brauzer
 * tanigan matn bilan dialog qatori mahalliy solishtiriladi, shuning uchun
 * limit yemaydi va oflayn ham ishlaydi. Bu TALAFFUZ bahosi emas: brauzer
 * to'g'ri tanigan har qanday gap o'tadi.
 */

const CONTRACTIONS = {
  "i'm": 'i am',
  "you're": 'you are',
  "we're": 'we are',
  "they're": 'they are',
  "he's": 'he is',
  "she's": 'she is',
  "it's": 'it is',
  "that's": 'that is',
  "what's": 'what is',
  "there's": 'there is',
  "let's": 'let us',
  "i've": 'i have',
  "you've": 'you have',
  "we've": 'we have',
  "i'll": 'i will',
  "you'll": 'you will',
  "we'll": 'we will',
  "i'd": 'i would',
  "you'd": 'you would',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "can't": 'can not',
  "cannot": 'can not',
  "won't": 'will not',
  "wouldn't": 'would not',
  "couldn't": 'could not',
  "shouldn't": 'should not',
  "haven't": 'have not',
  "hasn't": 'has not',
};

/** Solishtirish uchun so'zlar: kichik harf, tinish belgisiz, qisqartmalar ochilgan */
export const tokenize = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/-/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((w) => (CONTRACTIONS[w] || w.replace(/^'+|'+$/g, '')).split(' '))
    .filter(Boolean);

/**
 * @returns {{ percent: number, words: Array<{ text: string, hit: boolean }> }}
 *   `words` — maqsadli gapning asl so'zlari (tinish belgilari bilan), har biri
 *   aytilganmi-yo'qmi. Tartib LCS bilan tekshiriladi: so'zlar joyi almashsa
 *   ham qisman to'g'ri hisoblanadi, lekin hammasi emas.
 */
export const matchSpeech = (target, spoken) => {
  const display = String(target || '').split(/\s+/).filter(Boolean);
  // Har bir ko'rinadigan so'z bir nechta tokenga ochilishi mumkin ("I'm" → i am)
  const owners = [];
  const targetTokens = [];
  display.forEach((w, i) => {
    for (const t of tokenize(w)) {
      targetTokens.push(t);
      owners.push(i);
    }
  });
  const spokenTokens = tokenize(spoken);

  const n = targetTokens.length;
  const m = spokenTokens.length;
  if (n === 0) return { percent: 0, words: [] };

  // LCS jadvali
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        targetTokens[i] === spokenTokens[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const hitTokens = new Array(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (targetTokens[i] === spokenTokens[j]) {
      hitTokens[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }

  // Ko'rinadigan so'z — uning hamma tokeni aytilgan bo'lsa to'g'ri
  const words = display.map((text, idx) => {
    const own = owners.map((o, k) => (o === idx ? k : -1)).filter((k) => k >= 0);
    return { text, hit: own.length === 0 || own.every((k) => hitTokens[k]) };
  });

  const hits = hitTokens.filter(Boolean).length;
  // Ortiqcha aytilgan so'zlar ham biroz jarimalanadi — aks holda uzun
  // tasodifiy nutq ham yuqori ball olardi
  const extra = Math.max(0, m - hits);
  const percent = Math.round((hits / Math.max(n, hits + extra * 0.5)) * 100);
  return { percent: Math.max(0, Math.min(100, percent)), words };
};

/** Qatorni "o'tdi" deb hisoblash chegarasi */
export const PASS_PERCENT = 80;
