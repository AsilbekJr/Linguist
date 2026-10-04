import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
const topic = JSON.parse(readFileSync(new URL('../../server/data/topics.json', import.meta.url)))[0];
const profile = {
  _id: '507f1f77bcf86cd799439011', name: 'Asilbek', email: 'a@test.uz', emailVerified: true,
  timezone: 'Asia/Tashkent', today: '2026-10-03', totalWords: 0, knownWords: 0,
  onboarding: { completed: true, level: 'beginner', planType: 'sprint' },
  dailyQuests: { date: '2026-10-03' }, currentStreak: 0,
  week: [{ day: '2026-10-03', weekday: 'Sh', status: 'today' }],
};
async function setup(page) {
  await page.addInitScript(() => localStorage.setItem('persist:linguist-root', JSON.stringify({
    auth: JSON.stringify({ user: { onboarding: { completed: true } }, token: null, isAuthenticated: true }),
    _persist: JSON.stringify({ version: -1, rehydrated: true }),
  })));
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname;
    let data = {};
    if (path === '/api/auth/refresh') data = { ...profile, token: 'test-token' };
    else if (path === '/api/auth/me') data = profile;
    else if (path === '/api/topics/current') data = { ...topic, words: topic.words.slice(0, 5), currentDay: 1, totalDays: 90 };
    else if (path === '/api/topics/active-words') data = { items: [] };
    else if (path === '/api/words' || path.endsWith('/due')) data = [];
    else if (path === '/api/vocab-topics') data = { levels: [{ key: 'elementary', title: 'Elementary', titleUz: 'Boshlang‘ich', cefrRange: 'A1–A2', topics: [{ id: 'fixture', unit: 1, title: 'People', titleUz: 'Odamlar', emoji: '👋', wordCount: 1, savedCount: 0, preview: ['hello'] }] }] };
    else if (path === '/api/vocab-topics/fixture') data = { id: 'fixture', title: 'People', titleUz: 'Odamlar', words: [{ word: 'hello', translation: 'salom', example: 'Hello!', exampleUz: 'Salom!', saved: false }] };
    await route.fulfill({ json: data });
  });
}
test('empty vocabulary learner learns words before the dialogue and quiz', async ({ page }) => {
  await setup(page);
  await page.goto('/topic');
  await page.getByRole('button', { name: /Boshlash|O.rganishni boshlash/ }).click();
  await expect(page.getByRole('heading', { name: 'Bugungi so‘zlar' }).or(page.getByRole('heading', { name: "Bugungi so'zlar" }))).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Dialog', exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: /Dialogga o.tish/ }).click();
  await expect(page.getByRole('heading', { name: 'Dialog', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Mini-test/ })).toBeVisible();
});
test('topic library is reachable and displays supplied translations', async ({ page }) => {
  await setup(page);
  await page.goto('/vocabulary?view=topics');
  await expect(page.getByText('Odamlar', { exact: true })).toBeVisible();
  await page.getByText('Odamlar', { exact: true }).click();
  await expect(page.getByText('salom', { exact: true })).toBeVisible();
});
test('calendar shows dates so today can be checked', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  const week = page.getByRole('list', { name: 'Oxirgi 7 kun' });
  await expect(week.getByText('3', { exact: true })).toBeVisible();
});

test('a late profile does not reset a scene already being studied', async ({ page }) => {
  await setup(page);
  let release;
  const ready = new Promise(resolve => { release = resolve; });
  await page.route(url => url.pathname === '/api/auth/refresh', route => route.fulfill({ json: { ...profile, today: undefined, token: 'test-token' } }));
  await page.route(url => url.pathname === '/api/auth/me', async route => {
    await ready;
    await route.fulfill({ json: profile });
  });
  let wordsRequested = false;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/words') wordsRequested = true; });
  try {
    await page.goto('/topic');
    await page.getByRole('button', { name: /Boshlash|O.rganishni boshlash/ }).click();
    await expect(page.getByRole('heading', { name: "Bugungi so'zlar" })).toBeVisible();
    const profileResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/me');
    release();
    await profileResponse;
    await page.getByRole('button', { name: /Dialogga o.tish/ }).click();
    await expect(page.getByRole('heading', { name: 'Dialog', exact: true })).toBeVisible();
    expect(wordsRequested).toBe(false);
  } finally { release(); }
});

test('Uzbek word preview is editable and saved only after confirmation', async ({ page }) => {
  await setup(page);
  const saved = [];
  await page.route(url => url.pathname === '/api/words/preview', route => route.fulfill({ json: { options: [{ word: 'apple', translation: 'olma', definition: 'a fruit', example: 'I eat an apple.', exampleUz: 'Men olma yeyman.' }] } }));
  await page.route(url => url.pathname === '/api/words', async route => {
    if (route.request().method() === 'POST') {
      saved.push(route.request().postDataJSON());
      await route.fulfill({ status: 201, json: { _id: 'word1' } });
    } else await route.fulfill({ json: [] });
  });
  await page.goto('/vocabulary');
  await page.getByRole('button', { name: "So'z qo'shish" }).click();
  await page.getByRole('tab', { name: "O'zbekcha", exact: true }).click();
  await page.getByLabel("O'zbekcha so'z").fill('olma');
  await page.getByRole('button', { name: 'Tarjimani topish' }).click();
  await expect(page.getByLabel('Inglizcha tarjima')).toHaveValue('apple');
  expect(saved).toHaveLength(0);
  await page.getByLabel('Misol gap').fill('This apple is red.');
  await page.getByLabel('Gap tarjimasi').fill('Bu olma qizil.');
  await page.getByRole('button', { name: 'Saqlash va takrorlash' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(saved[0]).toMatchObject({ word: 'apple', manualTranslation: 'olma', manualExamples: ['This apple is red.'], manualExampleUz: 'Bu olma qizil.' });
});

test('Uzbek microphone input is shown for correction before translation', async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() {
        if (this.lang !== 'uz-UZ') throw new Error('Expected Uzbek recognition');
        setTimeout(() => { this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: 'olma' }], { isFinal: true })] }); this.onend?.(); }, 0);
      }
      stop() { this.onend?.(); }
      abort() {}
    };
  });
  await page.goto('/vocabulary');
  await page.getByRole('button', { name: "So'z qo'shish" }).click();
  await page.getByRole('tab', { name: "O'zbekcha", exact: true }).click();
  await page.getByRole('button', { name: "O'zbekcha aytish" }).click();
  await expect(page.getByLabel("O'zbekcha so'z")).toHaveValue('olma');
  await page.getByLabel("O'zbekcha so'z").fill('qizil olma');
  await expect(page.getByLabel("O'zbekcha so'z")).toHaveValue('qizil olma');
});

test('sentence library accepts a written review and keeps the result visible', async ({ page }) => {
  await setup(page);
  await page.route(url => url.pathname === '/api/review/phrases', route => route.fulfill({ json: [{ _id: 'phrase1', text: 'I eat an apple.', textUz: 'Men olma yeyman.', wordLabels: ['apple'], wordIds: [], stage: 0, learned: false, nextReviewDate: '2000-01-01' }] }));
  let answer;
  await page.route(url => url.pathname === '/api/review/phrases/phrase1/check', async route => {
    answer = route.request().postDataJSON();
    await route.fulfill({ json: { status: 'ok', isCorrect: true, percent: 100, text: 'I eat an apple.', words: [{ text: 'I eat an apple.', hit: true }], stage: 1, intervalDays: 1 } });
  });
  await page.goto('/vocabulary?view=phrases');
  await expect(page.getByText('Men olma yeyman.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Takrorlash', exact: true }).click();
  if (await page.getByRole('button', { name: 'Yozib javob berish' }).isVisible()) await page.getByRole('button', { name: 'Yozib javob berish' }).click();
  await page.getByRole('textbox', { name: 'Inglizcha gap' }).fill('I eat an apple.');
  await page.getByRole('button', { name: 'Gapni tekshirish' }).click();
  await expect(page.getByText('Yodingizda!', { exact: false })).toBeVisible();
  expect(answer).toEqual({ answer: 'I eat an apple.', source: 'text' });
});

test('review continues to the next sentence batch instead of leaving cards stranded', async ({ page }) => {
  await setup(page);
  const remaining = Array.from({ length: 6 }, (_, index) => ({ _id: `phrase${index}`, textUz: `Gap ${index + 1}`, hint: 'I ___', stage: 0 }));
  await page.route(url => url.pathname === '/api/review/phrases/due', route => route.fulfill({ json: remaining.slice(0, 5) }));
  await page.route(url => /^\/api\/review\/phrases\/phrase\d+\/check$/.test(url.pathname), async route => {
    const id = new URL(route.request().url()).pathname.split('/')[4];
    remaining.splice(remaining.findIndex(card => card._id === id), 1);
    await route.fulfill({ json: { status: 'ok', isCorrect: true, percent: 100, text: 'I eat an apple.', words: [{ text: 'I eat an apple.', hit: true }], stage: 1, intervalDays: 1 } });
  });
  await page.goto('/');
  await expect(page.getByText('Gap 1', { exact: true })).toBeVisible();
  if (await page.getByRole('button', { name: 'Yozib javob berish' }).isVisible()) await page.getByRole('button', { name: 'Yozib javob berish' }).click();
  for (let index = 0; index < 5; index++) {
    await expect(page.getByText(`Gap ${index + 1}`, { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Inglizcha gap' }).fill('I eat an apple.');
    await page.getByRole('button', { name: 'Gapni tekshirish' }).click();
    await page.getByRole('button', { name: index === 4 ? "So'zlarga o'tish" : 'Keyingi', exact: true }).click();
  }
  await expect(page.getByText('Gap 6', { exact: true })).toBeVisible();
});

async function fakeEnglishSpeech(page, text) {
  await page.addInitScript(transcript => {
    window.SpeechRecognition = class {
      start() {
        if (this.lang !== 'en-US') throw new Error('Expected English recognition');
        setTimeout(() => { this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript }], { isFinal: true })] }); this.onend?.(); }, 0);
      }
      stop() { this.onend?.(); }
      abort() {}
    };
  }, text);
}

test('a scene request interrupted by closing the app is fetched again after reopening', async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => {
    const key = 'persist:linguist-root';
    const state = JSON.parse(localStorage.getItem(key));
    state.api = JSON.stringify({
      queries: { 'getCurrentTopic(undefined)': { status: 'pending', endpointName: 'getCurrentTopic', requestId: 'closed-tab-request', startedTimeStamp: Date.now() - 5000 } },
      mutations: {}, provided: { tags: {}, keys: {} }, subscriptions: {},
    });
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.goto('/topic');
  await expect(page.getByRole('button', { name: /Boshlash|O.rganishni boshlash/ })).toBeVisible();
});

test('a spoken sentence waits for confirmation and a correction is submitted as text', async ({ page }) => {
  await setup(page);
  await fakeEnglishSpeech(page, 'I eat an apple.');
  await page.route(url => url.pathname === '/api/review/phrases/due', route => route.fulfill({ json: [{ _id: 'phrase1', textUz: 'Men olma yeyman.', sourceWord: 'apple', stage: 0 }] }));
  const submitted = [];
  await page.route(url => url.pathname === '/api/review/phrases/phrase1/check', async route => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill({ json: { status: 'ok', isCorrect: true, percent: 100, text: 'I eat an apple.', words: [{ text: 'I eat an apple.', hit: true }], stage: 1, intervalDays: 1 } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Aytish', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Inglizcha gap' })).toHaveValue('I eat an apple.');
  expect(submitted).toHaveLength(0);
  await page.getByRole('textbox', { name: 'Inglizcha gap' }).fill('I eat a red apple.');
  await page.getByRole('button', { name: 'Gapni tekshirish' }).click();
  await expect(page.getByText('Yodingizda!', { exact: false })).toBeVisible();
  expect(submitted[0]).toEqual({ answer: 'I eat a red apple.', source: 'text' });
});

test('a spoken word recall is confirmed before its voice answer is saved', async ({ page }) => {
  await setup(page);
  await fakeEnglishSpeech(page, 'apple');
  await page.route(url => url.pathname === '/api/review/due', route => route.fulfill({ json: [{ _id: 'word1', mode: 'recall', translation: 'olma', stage: 2, hint: { firstLetter: 'a', length: 5 } }] }));
  const submitted = [];
  await page.route(url => url.pathname === '/api/review/word1/check', async route => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill({ json: { status: 'ok', mode: 'recall', isCorrect: true, correctAnswer: 'apple', reveal: { word: 'apple', translation: 'olma' }, stage: 3, intervalDays: 3 } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: "So'zni aytish" }).click();
  await expect(page.getByPlaceholder("inglizcha so'z")).toHaveValue('apple');
  expect(submitted).toHaveLength(0);
  await page.getByRole('button', { name: 'Tekshirish', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'apple', exact: true })).toBeVisible();
  expect(submitted[0]).toMatchObject({ mode: 'recall', answer: 'apple', source: 'voice' });
});

test('sentence creation can switch languages, recognize Uzbek and save its edited English translation', async ({ page }) => {
  await setup(page);
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() {
        if (this.lang !== 'uz-UZ') throw new Error('Expected Uzbek recognition');
        setTimeout(() => { this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: 'Men bugun olma yeyman.' }], { isFinal: true })] }); this.onend?.(); }, 0);
      }
      stop() { this.onend?.(); }
      abort() {}
    };
  });
  const saved = [];
  const translations = [];
  await page.route(url => url.pathname === '/api/review/phrases', async route => {
    if (route.request().method() === 'POST') { saved.push(route.request().postDataJSON()); await route.fulfill({ status: 201, json: { _id: 'phrase1' } }); }
    else await route.fulfill({ json: [] });
  });
  await page.route(url => url.pathname === '/api/review/phrases/translate', async route => {
    const body = route.request().postDataJSON();
    translations.push(body);
    await route.fulfill({ json: { translation: body.sourceLanguage === 'uz' ? 'I eat an apple today.' : 'Men bugun qizil olma yeyman.' } });
  });
  await page.goto('/vocabulary?view=phrases');
  await page.getByRole('button', { name: "Gap qo'shish" }).click();
  await page.getByRole('button', { name: "Tarjima yo'nalishini almashtirish" }).click();
  await page.getByRole('button', { name: 'Gapni aytish' }).click();
  await expect(page.getByLabel("O'zbekcha gap", { exact: true })).toHaveValue('Men bugun olma yeyman.');
  await page.getByRole('button', { name: 'Tarjima qilish', exact: true }).click();
  await expect(page.getByLabel('Inglizcha tarjima', { exact: true })).toHaveValue('I eat an apple today.');
  expect(saved).toHaveLength(0);
  await page.getByLabel('Inglizcha tarjima', { exact: true }).fill('I eat a red apple today.');
  await page.getByRole('button', { name: "Tarjima yo'nalishini almashtirish" }).click();
  await expect(page.getByLabel('Inglizcha gap', { exact: true })).toHaveValue('I eat a red apple today.');
  await page.getByRole('button', { name: 'Tarjima qilish', exact: true }).click();
  await expect(page.getByLabel("Gapning o'zbekcha tarjimasi", { exact: true })).toHaveValue('Men bugun qizil olma yeyman.');
  await page.getByRole('button', { name: 'Saqlash va takrorlash' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(saved[0]).toMatchObject({ text: 'I eat a red apple today.', textUz: 'Men bugun qizil olma yeyman.' });
  expect(translations.map(item => item.sourceLanguage)).toEqual(['uz', 'en']);
});

test('an old sentence translation cannot overwrite an edited input', async ({ page }) => {
  await setup(page);
  await page.route(url => url.pathname === '/api/review/phrases', route => route.fulfill({ json: [] }));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(url => url.pathname === '/api/review/phrases/translate', async route => { await gate; await route.fulfill({ json: { translation: 'Men olma yeyman.' } }); });
  await page.goto('/vocabulary?view=phrases');
  await page.getByRole('button', { name: "Gap qo'shish" }).click();
  await page.getByLabel('Inglizcha gap', { exact: true }).fill('I eat an apple.');
  try {
    const request = page.waitForRequest(req => new URL(req.url()).pathname === '/api/review/phrases/translate');
    await page.getByRole('button', { name: 'Tarjima qilish', exact: true }).click();
    await request;
    await page.getByLabel('Inglizcha gap', { exact: true }).fill('I drink some water.');
    const response = page.waitForResponse(res => new URL(res.url()).pathname === '/api/review/phrases/translate');
    release();
    await response;
    await expect(page.getByRole('button', { name: 'Tarjima qilish', exact: true })).toBeEnabled();
    await expect(page.getByLabel("Gapning o'zbekcha tarjimasi", { exact: true })).toHaveValue('');
  } finally { release(); }
});
