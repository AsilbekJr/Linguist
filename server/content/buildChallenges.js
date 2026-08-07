#!/usr/bin/env node
/**
 * Speaking challenge matnlarini REAL kurs kontentidan generatsiya qiladi.
 *
 * Ilgari `challenges.json` da 100 ta kun bor edi, lekin atigi 4 ta unikal matn
 * tanasi — 2-kun va 50-kun bir xil matnni ko'rsatardi, faqat mavzu nomi
 * almashardi:
 *   "Welcome to day 50 of your challenge! ... Practice makes perfect."
 * Bu funksiya emas, placeholder edi va "100 kunlik challenge" deb sotilardi.
 *
 * Endi har bir kun o'sha kunning haqiqiy dialogidan tuziladi: foydalanuvchi
 * o'zi o'rgangan so'zlarni o'z ovozida gapiradi. Kunlar soni kurs hajmiga
 * teng — ya'ni raqam haqiqatni aks ettiradi.
 *
 *   npm run content:challenges
 */

const fs = require('fs');
const path = require('path');

const topicsPath = path.join(__dirname, '../data/topics.json');
const outPath = path.join(__dirname, '../data/challenges.json');

const topics = JSON.parse(fs.readFileSync(topicsPath, 'utf8'));

const challenges = topics.map((topic) => {
  const lines = topic.dialogue.map((l) => l.en);
  const focusWords = topic.words.slice(0, 5).map((w) => w.word);

  return {
    dayNumber: topic.day,
    cefr: topic.cefr,
    topic: topic.topic,
    topicUz: topic.topicUz,
    /** Ovoz chiqarib o'qish uchun matn — o'sha kunning haqiqiy dialogi */
    text: lines.join(' '),
    /** Qatorma-qator mashq uchun */
    lines,
    focusWords,
    instructionUz: `"${topic.topicUz}" dialogini ovoz chiqarib o'qing. E'tibor bering: ${focusWords.join(', ')}.`,
  };
});

fs.writeFileSync(outPath, JSON.stringify(challenges, null, 2) + '\n', 'utf8');

const uniqueTexts = new Set(challenges.map((c) => c.text));
console.log(`\n✓ ${challenges.length} ta challenge yozildi`);
console.log(`  Unikal matnlar: ${uniqueTexts.size}/${challenges.length}`);
if (uniqueTexts.size !== challenges.length) {
  console.error('  ✗ Takroriy matnlar bor — build to\'xtatildi');
  process.exit(1);
}
console.log(`  Fayl: ${path.relative(process.cwd(), outPath)}\n`);
