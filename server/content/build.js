#!/usr/bin/env node
/**
 * Kontent build: ixcham manba (curriculum/*.js) → data/topics.json
 *
 * Nega manba alohida:
 *  - JSON'da qo'lda 240 ta so'z yozish xatoga juda moyil;
 *  - manba faylda kortej (tuple) formati ishlatiladi, u ixcham va o'qishli;
 *  - build paytida validator ishlaydi va yaroqsiz kontent hech qachon
 *    `data/topics.json` ga yetib bormaydi.
 *
 *   npm run content:build
 */

const fs = require('fs');
const path = require('path');
const { validateCurriculum } = require('./schema');
const { checkAgainstDictionary, loadSnapshot, loadExceptions } = require('./dictionaryCheck');

const WORD_FIELDS = ['word', 'translation', 'phonetic', 'partOfSpeech', 'definition', 'example', 'exampleUz'];

/** ['name','ism','/neɪm/','noun','...','My name is Aziz.','Mening ismim Aziz.', ['first name']] */
const expandWord = (tuple, topicCefr) => {
  if (!Array.isArray(tuple)) return tuple; // allaqachon obyekt
  const word = {};
  WORD_FIELDS.forEach((field, i) => {
    word[field] = tuple[i] ?? '';
  });
  word.cefr = tuple[7] || topicCefr;
  word.collocations = Array.isArray(tuple[8]) ? tuple[8] : [];
  return word;
};

/** ['Aziz', "Hi!", "Salom!"] */
const expandDialogue = (line) =>
  Array.isArray(line) ? { speaker: line[0], en: line[1], uz: line[2] } : line;

const expandTopic = (topic) => ({
  day: topic.day,
  cefr: topic.cefr,
  topic: topic.topic,
  topicUz: topic.topicUz,
  description: topic.description,
  story: topic.story,
  scenarioEmoji: topic.emoji || topic.scenarioEmoji || '📚',
  grammarFocus: topic.grammarFocus || null,
  dialogue: (topic.dialogue || []).map(expandDialogue),
  words: (topic.words || []).map((w) => expandWord(w, topic.cefr)),
});

const main = () => {
  const curriculumDir = path.join(__dirname, 'curriculum');
  const files = fs
    .readdirSync(curriculumDir)
    .filter((f) => f.endsWith('.js'))
    .sort();

  const raw = [];
  for (const file of files) {
    const part = require(path.join(curriculumDir, file));
    if (!Array.isArray(part)) {
      console.error(`${file}: massiv eksport qilishi kerak`);
      process.exit(1);
    }
    raw.push(...part);
  }

  raw.sort((a, b) => a.day - b.day);
  const topics = raw.map(expandTopic);

  const result = validateCurriculum(topics);
  const dict = checkAgainstDictionary(topics, loadSnapshot(), loadExceptions());

  console.log(`\nManba: ${files.length} fayl, ${topics.length} mavzu`);
  if (result.stats) {
    const s = result.stats;
    console.log(`  So'z slotlari:   ${s.totalSlots}`);
    console.log(`  Unikal so'zlar:  ${s.uniqueWords} (${s.uniqueRatio}%)`);
    console.log(`  Daraja bo'yicha: ${JSON.stringify(s.byCefr)}`);
  }
  if (dict.stats) {
    const d = dict.stats;
    console.log(`  Lug'at bilan:    ${d.checked} ta tekshirildi, ` +
      `${d.phoneticMismatches} IPA / ${d.posMismatches} POS farqi, ` +
      `${d.exceptions} ta ko'rib chiqilgan istisno`);
  }

  const warnings = [...result.warnings, ...dict.warnings];
  if (warnings.length) {
    console.log(`\nOgohlantirishlar (${warnings.length}):`);
    for (const w of warnings.slice(0, 20)) console.log(`  ! ${w}`);
    if (warnings.length > 20) console.log(`  … va yana ${warnings.length - 20} ta`);
  }

  const errors = [...result.errors, ...dict.errors];
  if (errors.length) {
    console.error(`\nBuild to'xtatildi — ${errors.length} ta xato:`);
    for (const e of errors.slice(0, 40)) console.error(`  ✗ ${e}`);
    if (errors.length > 40) {
      console.error(`  … va yana ${errors.length - 40} ta`);
    }
    console.error('');
    process.exit(1);
  }

  const out = path.join(__dirname, '../data/topics.json');
  fs.writeFileSync(out, JSON.stringify(topics, null, 2) + '\n', 'utf8');
  console.log(`\n✓ Yozildi: ${path.relative(process.cwd(), out)}\n`);
};

main();
