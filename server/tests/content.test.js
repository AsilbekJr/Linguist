const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const { validateCurriculum, containsWord, validateWord } = require('../content/schema');

const topics = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/topics.json'), 'utf8')
);

test('ishlab chiqarishdagi kontent validatsiyadan o\'tadi', () => {
  const result = validateCurriculum(topics);
  assert.equal(
    result.ok,
    true,
    `Kontent xatolari:\n${result.errors.slice(0, 10).map((e) => '  - ' + e).join('\n')}`
  );
});

test('kontent takroriylik chegarasidan o\'tadi', () => {
  const { stats } = validateCurriculum(topics);
  // Eski topics.json: 45/325 = 13.8%
  assert.ok(
    stats.uniqueRatio >= 85,
    `unikal so'zlar ulushi ${stats.uniqueRatio}% — juda past`
  );
  assert.ok(stats.topics >= 20, `mavzular soni ${stats.topics}`);
});

test('boshlang\'ich kunlarda C1 leksika yo\'q', () => {
  // Eski kontentda 1-kun "Essential Daily Life Vocabulary" ichida
  // Ubiquitous, Meticulous, Procrastinate bor edi.
  const banned = ['ubiquitous', 'meticulous', 'procrastinate', 'obsolete', 'paradigm', 'empirical'];
  for (const topic of topics.slice(0, 10)) {
    for (const w of topic.words) {
      assert.ok(
        !banned.includes(w.word.toLowerCase()),
        `Kun ${topic.day} da C1 so'z: ${w.word}`
      );
      assert.ok(
        ['A1', 'A2'].includes(w.cefr),
        `Kun ${topic.day} da "${w.word}" darajasi ${w.cefr}`
      );
    }
  }
});

test('har bir so\'z mavzu dialogida haqiqatan ishlatilgan', () => {
  for (const topic of topics) {
    for (const w of topic.words) {
      const context = [
        topic.story,
        ...(topic.dialogue || []).map((l) => l.en),
        ...topic.words.filter((o) => o.word !== w.word).map((o) => o.example),
      ];
      assert.ok(
        context.some((part) => containsWord(part, w.word)),
        `Kun ${topic.day}: "${w.word}" dialogda ishlatilmagan`
      );
    }
  }
});

test('har bir mavzuda dialog va grammatika fokusi bor', () => {
  for (const topic of topics) {
    assert.ok(topic.dialogue.length >= 4, `Kun ${topic.day}: dialog qisqa`);
    assert.ok(topic.topicUz, `Kun ${topic.day}: topicUz yo'q`);
    assert.ok(topic.story, `Kun ${topic.day}: story yo'q`);
    for (const line of topic.dialogue) {
      assert.ok(line.en && line.uz, `Kun ${topic.day}: dialog qatorida tarjima yo'q`);
    }
  }
});

test('validator soxta kontentni RAD ETADI (regressiya himoyasi)', () => {
  // Eski topics.json ning aynan shakli: mavzu nomi so'zlarga mos emas
  const fake = [
    {
      day: 1,
      cefr: 'A1',
      topic: 'Food and Cooking',
      topicUz: 'Ovqat',
      story: 'Bugun ovqat haqida gaplashamiz.',
      dialogue: [
        { speaker: 'A', en: 'What do you want to eat?', uz: 'Nima yemoqchisiz?' },
        { speaker: 'B', en: 'Some bread, please.', uz: 'Non, iltimos.' },
        { speaker: 'A', en: 'And to drink?', uz: 'Ichimlikchi?' },
        { speaker: 'B', en: 'Just water.', uz: 'Faqat suv.' },
      ],
      words: Array.from({ length: 8 }, (_, i) => ({
        word: ['hypothesis', 'paradigm', 'quantitative', 'empirical', 'inference', 'proponent', 'synthesize', 'ambiguous'][i],
        translation: 'tarjima',
        definition: 'a definition',
        phonetic: '/test/',
        partOfSpeech: 'noun',
        cefr: 'C1',
        example: `This is a ${['hypothesis', 'paradigm', 'quantitative', 'empirical', 'inference', 'proponent', 'synthesize', 'ambiguous'][i]} example.`,
      })),
    },
  ];

  const result = validateCurriculum(fake);
  assert.equal(result.ok, false, 'soxta kontent o\'tib ketdi');
  assert.ok(
    result.errors.some((e) => e.includes('mavzu kontekstida ishlatilmagan')),
    'tegishlilik tekshiruvi ishlamadi'
  );
  assert.ok(
    result.errors.some((e) => e.includes('juda og\'ir')),
    'daraja tekshiruvi ishlamadi'
  );
});

test('validator takroriy so\'zlarni RAD ETADI', () => {
  const repeated = Array.from({ length: 4 }, (_, d) => ({
    day: d + 1,
    cefr: 'A1',
    topic: `Topic ${d + 1}`,
    topicUz: `Mavzu ${d + 1}`,
    story: 'Bir xil so\'zlar qayta-qayta ishlatiladi: water bread tea food eat drink hot cold cup table.',
    dialogue: [
      { speaker: 'A', en: 'water bread tea food eat', uz: 'suv non choy ovqat yemoq' },
      { speaker: 'B', en: 'drink hot cold cup table', uz: 'ichmoq issiq sovuq piyola stol' },
      { speaker: 'A', en: 'water again', uz: 'yana suv' },
      { speaker: 'B', en: 'bread again', uz: 'yana non' },
    ],
    words: ['water', 'bread', 'tea', 'food', 'eat', 'drink', 'hot', 'cold'].map((w) => ({
      word: w,
      translation: `${w}-uz`,
      definition: 'def',
      phonetic: '/x/',
      partOfSpeech: 'noun',
      cefr: 'A1',
      example: `I like ${w} very much.`,
    })),
  }));

  const result = validateCurriculum(repeated);
  assert.equal(result.ok, false);
  assert.ok(
    result.errors.some((e) => e.includes('takrorlangan')),
    `takroriylik ushlanmadi: ${result.errors.join(' | ')}`
  );
});

test('misol gapda so\'zning o\'zi bo\'lishi shart', () => {
  const errs = validateWord(
    {
      word: 'water',
      translation: 'suv',
      definition: 'clear liquid',
      phonetic: '/ˈwɔːtə/',
      partOfSpeech: 'noun',
      example: 'I am very thirsty today.',
    },
    { topicRef: 'test' }
  );
  assert.ok(errs.some((e) => e.includes('misol gapda so\'zning o\'zi yo\'q')));
});

test('containsWord so\'z shakllarini taniydi, soxta moslikni bermaydi', () => {
  assert.equal(containsWord('I can solve this problem', 'solve'), true);
  assert.equal(containsWord('I am solving this problem', 'solve'), true, "solving → solve");
  assert.equal(containsWord('She studies at home', 'study'), true, 'studies → study');
  assert.equal(containsWord('The bus stopped here', 'stop'), true, 'stopped → stop');
  assert.equal(containsWord('We had three meetings', 'meeting'), true);

  // Substring soxta moslik bermasligi kerak
  assert.equal(containsWord('I like meat', 'eat'), false, '"meat" ichidagi "eat" hisoblanmasligi kerak');
  assert.equal(containsWord('The sun is bright', 'son'), false);
  assert.equal(containsWord('a nice corner', 'nice'), true);
});
