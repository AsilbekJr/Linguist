const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const {
  MAX_PHONETIC_DISTANCE,
  normalizePhonetic,
  phoneticVariants,
  editDistance,
  phoneticDistance,
  phoneticMatches,
  posMatches,
  checkAgainstDictionary,
  loadSnapshot,
  loadExceptions,
  saveExceptions,
} = require('../content/dictionaryCheck');

const { lookupSnapshot } = require('../utils/dictionarySnapshot');

const topics = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/topics.json'), 'utf8')
);

// ─── IPA normallashtirish ────────────────────────────────────────────────────
//
// Bu testlar bitta narsani himoya qiladi: NOTATSION farq xato deb
// hisoblanmasin. Aks holda validator 300 so'zning yarmiga ogohlantirish
// beradi va birinchi kunning o'zida e'tibordan qoladi.

test('IPA: chegara belgilari, bo\'g\'in nuqtasi va urg\'u tashlanadi', () => {
  assert.equal(normalizePhonetic('/ˈstjuː.dənt/'), normalizePhonetic('/ˈstjuːdənt/'));
  assert.equal(normalizePhonetic('[θaŋk]'), 'θaŋk');
  assert.equal(normalizePhonetic('  /neɪm/  '), 'neɪm');
});

test('IPA: ɹ↔r, ɛ↔e, ɡ↔g bir xil deb qaraladi', () => {
  assert.equal(normalizePhonetic('/ɹeɪn/'), normalizePhonetic('/reɪn/'));
  assert.equal(normalizePhonetic('/bɹɛd/'), normalizePhonetic('/bred/'));
  assert.equal(normalizePhonetic('/ɡəʊl/'), normalizePhonetic('/gəʊl/'));
});

test('IPA: qo\'shma diakritikalar (bog\'lovchi yoy, bo\'g\'in belgisi) tashlanadi', () => {
  assert.equal(normalizePhonetic('/t͡ʃiːp/'), normalizePhonetic('/tʃiːp/'));
  assert.equal(normalizePhonetic('/ˈhɑːmfl̩/'), normalizePhonetic('/ˈhɑːmfl/'));
});

test('IPA: unli uzunligi SAQLANADI — sheep/ship farqi yo\'qolmasligi kerak', () => {
  assert.notEqual(normalizePhonetic('/ʃiːp/'), normalizePhonetic('/ʃɪp/'));
  assert.ok(phoneticDistance('/ʃiːp/', ['/ʃɪp/']) > 0);
});

test('IPA: ixtiyoriy segment ikkala variantga yoyiladi', () => {
  const variants = phoneticVariants('/ˈmʌðə(ɹ)/');
  assert.ok(variants.includes('mʌðə'), `norotik variant yo'q: ${variants}`);
  assert.ok(variants.includes('mʌðər'), `rotik variant yo'q: ${variants}`);
});

test('IPA: kuchsiz unli almashinuvi va schwa tushishi bepul', () => {
  // /ˈkɪtʃɪn/ va /ˈkɪtʃən/ — bir xil talaffuzning ikki yozuvi
  assert.equal(phoneticDistance('/ˈkɪtʃɪn/', ['/ˈkɪt͡ʃən/']), 0);
  // /ˈsiːzn/ va /ˈsiːzən/ — bo'g'in hosil qiluvchi undosh
  assert.equal(phoneticDistance('/ˈsiːzn/', ['/ˈsiːzən/']), 0);
  assert.equal(phoneticDistance('/dɪˈvaɪs/', ['/dəˈvaɪs/']), 0);
});

test('IPA: to\'liq unli almashinuvi BEPUL EMAS', () => {
  // Butun mexanizm shu farq uchun qurilgan: kuchsiz unli almashinuvi
  // (yuqoridagi test) va haqiqiy fonema xatosi bir xil ko'rinmasligi kerak
  assert.ok(phoneticDistance('/wɔːk/', ['/wɜːk/']) > 0);
  assert.ok(phoneticDistance('/bæd/', ['/bed/']) > 0);
});

test('IPA: bir nechta ixtiyoriy segment kombinatsiyalanadi', () => {
  const variants = phoneticVariants('/ˈɡɹæn(d)ˌmʌðə(ɹ)/');
  assert.ok(variants.includes('grænmʌðə'));
  assert.ok(variants.includes('grændmʌðər'));
});

test('editDistance: oddiy holatlar', () => {
  assert.equal(editDistance('abc', 'abc'), 0);
  assert.equal(editDistance('abc', 'abd'), 1);
  assert.equal(editDistance('', 'abc'), 3);
  assert.equal(editDistance('abc', ''), 3);
});

// ─── Mos kelish qarori ───────────────────────────────────────────────────────

test('to\'g\'ri IPA lug\'atning boshqa notatsiyasiga mos keladi', () => {
  assert.ok(phoneticMatches('/reɪn/', ['/ɹeɪn/']));
  assert.ok(phoneticMatches('/ˈmʌðə/', ['/ˈmʌðə(ɹ)/', '/ˈmʌðɚ/']));
  assert.ok(phoneticMatches('/ˈteɪbl/', ['/ˈteɪbəl/']));
});

test('mutlaqo boshqa so\'zning IPA\'si ushlanadi', () => {
  // Aynan shu holat uchun tekshiruv yozilgan: "work" o'rniga "walk" transkripsiyasi
  assert.equal(phoneticMatches('/wɔːk/', ['/wɜːk/', '/wɝk/']), false);
  assert.ok(phoneticDistance('/wɔːk/', ['/wɜːk/']) > MAX_PHONETIC_DISTANCE);
});

test('posMatches: noun/proper noun ekvivalent, tekshirilmaydigan POS o\'tadi', () => {
  assert.ok(posMatches('noun', [{ partOfSpeech: 'proper noun' }]));
  assert.ok(posMatches('verb', [{ partOfSpeech: 'noun' }, { partOfSpeech: 'verb' }]));
  assert.equal(posMatches('verb', [{ partOfSpeech: 'noun' }]), false);
  // Sxemada yo'q POS — schema.js allaqachon tekshirgan, bu yerda to'sqinlik qilmaymiz
  assert.ok(posMatches('phrase', [{ partOfSpeech: 'interjection' }]));
});

// ─── Butun kurs bo'yicha tekshiruv ───────────────────────────────────────────

test('ishlab chiqarishdagi kontent lug\'at tekshiruvidan o\'tadi', () => {
  const result = checkAgainstDictionary(topics, loadSnapshot(), loadExceptions());
  assert.equal(
    result.ok,
    true,
    `Lug'at xatolari:\n${result.errors.slice(0, 10).map((e) => '  - ' + e).join('\n')}`
  );
});

test('snapshot kurrikulumning hamma so\'zini qamrab oladi', () => {
  const entries = loadSnapshot();
  assert.ok(entries, 'snapshot topilmadi — npm run dict:fetch');
  const { stats } = checkAgainstDictionary(topics, entries, loadExceptions());
  assert.equal(stats.missing, 0, 'snapshot eskirgan — npm run dict:fetch');
  assert.equal(stats.checked, 300);
});

test('ogohlantirishlar noldan boshlanadi — aks holda ular o\'qilmay qoladi', () => {
  // Bu test tekshiruvning eng zaif joyini himoya qiladi. Doimiy 27 ta
  // ogohlantirish bo'lsa, 28-chisi — haqiqiy xato — ko'zga tashlanmasdi.
  const { warnings, stats } = checkAgainstDictionary(topics, loadSnapshot(), loadExceptions());
  assert.equal(
    warnings.length,
    0,
    `Ko'rilmagan farqlar bor:\n${warnings.map((w) => '  - ' + w).join('\n')}`
  );
  assert.equal(stats.staleExceptions, 0, 'phonetic-exceptions.json da keraksiz yozuv bor');
});

test('istisno ro\'yxati farqni yashiradi, lekin faqat o\'zinikini', () => {
  const entries = { walk: { word: 'walk', phonetics: ['/wɔːk/'], meanings: [] } };
  const fake = [{ day: 1, words: [{ word: 'walk', phonetic: '/wɜːk/', partOfSpeech: 'verb' }] }];

  const without = checkAgainstDictionary(fake, entries);
  assert.equal(without.stats.phoneticMismatches, 1);

  const withException = checkAgainstDictionary(fake, entries, {
    words: { walk: "sinov uchun" },
  });
  assert.equal(withException.stats.phoneticMismatches, 0);
  assert.equal(withException.stats.exceptions, 1);
});

test('eskirgan istisno ogohlantirish beradi', () => {
  const entries = { walk: { word: 'walk', phonetics: ['/wɔːk/'], meanings: [] } };
  const fake = [{ day: 1, words: [{ word: 'walk', phonetic: '/wɔːk/', partOfSpeech: 'verb' }] }];
  const result = checkAgainstDictionary(fake, entries, { words: { walk: 'endi kerak emas' } });
  assert.equal(result.stats.staleExceptions, 1);
  assert.match(result.warnings.join(' '), /keraksiz istisno/);
});

test('saveExceptions qo\'lda yozilgan sabablarni saqlab qoladi', () => {
  const tmp = path.join(__dirname, 'tmp-exceptions.json');
  try {
    fs.writeFileSync(
      tmp,
      JSON.stringify({ note: 'qo\'lda', words: { old: 'GOAT unlisi' }, posWords: { near: 'predlog' } }),
      'utf8'
    );
    saveExceptions({ old: 'avtomatik qoralama', cold: 'avtomatik qoralama' }, tmp);

    const saved = loadExceptions(tmp);
    assert.equal(saved.words.old, 'GOAT unlisi', 'mavjud sabab almashtirilgan');
    assert.equal(saved.words.cold, 'avtomatik qoralama', 'yangi yozuv qo\'shilmagan');
    assert.equal(saved.posWords.near, 'predlog', 'POS istisnolari yo\'qolgan');
    assert.equal(saved.note, 'qo\'lda');
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});

test('snapshot yo\'q bo\'lsa tekshiruv o\'tkazib yuboriladi, build yiqilmaydi', () => {
  const result = checkAgainstDictionary(topics, null);
  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.equal(result.stats, null);
  assert.match(result.warnings[0], /dict:fetch/);
});

test('lug\'atda yo\'q so\'z XATO beradi (imlo xatosi signali)', () => {
  const fake = [{ day: 1, words: [{ word: 'teh', phonetic: '/teɪ/', partOfSpeech: 'noun' }] }];
  const result = checkAgainstDictionary(fake, { teh: { word: 'teh', notFound: true } });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /Imlo/);
});

// ─── Runtime qidiruvi ────────────────────────────────────────────────────────

test('lookupSnapshot kurrikulum so\'zini tarmoqsiz qaytaradi', () => {
  const entry = lookupSnapshot('student');
  assert.ok(entry, 'student snapshotda bo\'lishi kerak');
  assert.equal(entry.partOfSpeech, 'noun');
  assert.ok(entry.definition.length > 0);
  assert.match(entry.phonetic, /^\//);
});

test('lookupSnapshot registrga bog\'liq emas', () => {
  // Route so'zni Title Case ga o'tkazadi ("Student"), snapshot kaliti kichik harf
  assert.deepEqual(lookupSnapshot('Student'), lookupSnapshot('student'));
});

test('lookupSnapshot begona so\'zga null qaytaradi — chaqiruvchi API\'ga boradi', () => {
  assert.equal(lookupSnapshot('zzzznotaword'), null);
});

test('lookupSnapshot ta\'rifga partOfSpeech prefiksini qo\'shmaydi', () => {
  // UI partOfSpeech ni alohida badge qilib ko'rsatadi (TopicVocabulary.jsx)
  const entry = lookupSnapshot('student');
  assert.equal(entry.definition.startsWith('('), false);
});
