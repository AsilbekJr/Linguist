#!/usr/bin/env node
/**
 * Kontent validatori — CLI.
 *
 *   npm run content:validate            # data/topics.json ni tekshiradi
 *   node content/validate.js <fayl>     # boshqa faylni tekshiradi
 *
 * Xato topilsa 1 kodi bilan chiqadi — CI'da build'ni to'xtatadi.
 */

const fs = require('fs');
const path = require('path');
const { validateCurriculum } = require('./schema');

const target = process.argv[2] || path.join(__dirname, '../data/topics.json');

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

console.log(`\nKontent: ${path.relative(process.cwd(), target)}`);
if (result.stats) {
  const s = result.stats;
  console.log(`  Mavzular:        ${s.topics}`);
  console.log(`  So'z slotlari:   ${s.totalSlots}`);
  console.log(`  Unikal so'zlar:  ${s.uniqueWords} (${s.uniqueRatio}%)`);
  console.log(`  Daraja bo'yicha: ${JSON.stringify(s.byCefr)}`);
}

if (result.warnings.length) {
  console.log(`\nOgohlantirishlar (${result.warnings.length}):`);
  for (const w of result.warnings) console.log(`  ! ${w}`);
}

if (!result.ok) {
  const shown = result.errors.slice(0, 40);
  console.error(`\nXatolar (${result.errors.length}):`);
  for (const e of shown) console.error(`  ✗ ${e}`);
  if (result.errors.length > shown.length) {
    console.error(`  … va yana ${result.errors.length - shown.length} ta`);
  }
  console.error('');
  process.exit(1);
}

console.log('\n✓ Kontent tekshiruvdan o\'tdi\n');
