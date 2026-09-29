#!/usr/bin/env node
/**
 * Kontent validatori — CLI.
 *
 *   npm run content:validate            # data/topics.json ni tekshiradi
 *   node content/validate.js <fayl>     # boshqa faylni tekshiradi
 *
 *   npm run content:validate -- --update-baseline
 *       Joriy IPA farqlarini "ko'rib chiqilgan" deb belgilaydi
 *       (content/phonetic-exceptions.json). Farqlarni O'QIB CHIQMASDAN
 *       ishlatmang — bu tekshiruvni ma'nosiz qilib qo'yadi.
 *
 * Xato topilsa 1 kodi bilan chiqadi — CI'da build'ni to'xtatadi.
 */

const fs = require('fs');
const path = require('path');
const { validateCurriculum } = require('./schema');
const {
  checkAgainstDictionary,
  loadSnapshot,
  loadExceptions,
  saveExceptions,
} = require('./dictionaryCheck');

const args = process.argv.slice(2);
const updateBaseline = args.includes('--update-baseline');
const target = args.find((a) => !a.startsWith('--')) || path.join(__dirname, '../data/topics.json');

if (!fs.existsSync(target)) {
  console.error(`Fayl topilmadi: ${target}`);
  process.exit(1);
}

let topics;
try {
  topics = JSON.parse(fs.readFileSync(target, 'utf8'));
} catch (err) {
  console.error(`JSON o'qib bo'lmadi: ${err.message}`);
  process.exit(1);
}

const result = validateCurriculum(topics);
const dict = checkAgainstDictionary(topics, loadSnapshot(), loadExceptions());

if (updateBaseline) {
  const count = saveExceptions(dict.mismatched);
  console.log(`\n✓ phonetic-exceptions.json yangilandi: ${count} ta yozuv.`);
  console.log('  Har birini ko\'rib chiqing — bu fayl kod ko\'rigidan o\'tishi kerak.\n');
  process.exit(0);
}

console.log(`\nKontent: ${path.relative(process.cwd(), target)}`);
if (result.stats) {
  const s = result.stats;
  console.log(`  Mavzular:        ${s.topics}`);
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
  for (const w of warnings) console.log(`  ! ${w}`);
}

const errors = [...result.errors, ...dict.errors];
if (errors.length) {
  const shown = errors.slice(0, 40);
  console.error(`\nXatolar (${errors.length}):`);
  for (const e of shown) console.error(`  ✗ ${e}`);
  if (errors.length > shown.length) {
    console.error(`  … va yana ${errors.length - shown.length} ta`);
  }
  console.error('');
  process.exit(1);
}

console.log('\n✓ Kontent tekshiruvdan o\'tdi\n');
