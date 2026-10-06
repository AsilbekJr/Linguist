import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const topic = JSON.parse(readFileSync(new URL('../../server/data/topics.json', import.meta.url)))[0];
const time = new Date('2026-10-03T07:00:00Z');
const user = {
  _id: '507f1f77bcf86cd799439011', name: 'Asilbek', emailVerified: true,
  timezone: 'Asia/Tashkent', today: '2026-10-03', totalWords: 2,
  onboarding: { completed: true, level: 'beginner', planType: 'sprint' },
  dailyQuests: { date: '2026-10-03' },
};
const conversation = {
  dayKey: user.today, sceneDone: false, speakCompleted: false,
  preview: { topicUz: 'Bugungi mavzu', situationUz: 'Bugungi vaziyat', partner: { name: 'Ali', emoji: '👋' }, targetWords: [] },
};
const query = (endpointName, data, timestamp = time.getTime()) => ({
  endpointName, data, status: 'fulfilled', fulfilledTimeStamp: timestamp,
});

async function setup(page, saved = {}, savedUser = user) {
  await page.clock.setFixedTime(time);
  await page.addInitScript(({ user, saved }) => {
    if (localStorage.getItem('persist:linguist-root')) return;
    localStorage.setItem('persist:linguist-root', JSON.stringify({
      auth: JSON.stringify({ user, token: null, isAuthenticated: true }),
      api: JSON.stringify({ queries: saved, mutations: {}, provided: { tags: {}, keys: {} }, subscriptions: {} }),
      _persist: JSON.stringify({ version: -1, rehydrated: true }),
    }));
  }, { user: savedUser, saved });
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname;
    const data = path === '/api/auth/refresh' ? { ...user, token: 'test-token' }
      : path === '/api/auth/me' ? user
      : path === '/api/topics/current' ? { ...topic, dayKey: user.today, words: topic.words.slice(0, 5), currentDay: 1, totalDays: 90 }
      : path === '/api/speak/today' ? conversation
      : path.endsWith('/due') ? [] : {};
    return route.fulfill({ json: data });
  });
}

test('yesterday scene is never displayed while the new day is loading', async ({ page }) => {
  const yesterday = { ...user, today: '2026-10-02', dailyQuests: { date: '2026-10-02', topicCompleted: true } };
  const oldTime = new Date('2026-10-02T18:59:00Z').getTime();
  await setup(page, {
    'getMe(undefined)': query('getMe', yesterday, oldTime),
    'getCurrentTopic(undefined)': query('getCurrentTopic', { ...topic, topic: 'YESTERDAY_SCENE', topicUz: 'YESTERDAY_SCENE', dayKey: yesterday.today }, oldTime),
  }, yesterday);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(url => url.pathname === '/api/auth/refresh', async route => {
    await gate;
    await route.fulfill({ json: { ...user, token: 'test-token' } });
  });
  await page.goto('/topic');
  await expect(page.getByText('YESTERDAY_SCENE', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Bugungi kun yuklanmoqda…', { exact: true })).toBeVisible();
  release();
  await expect(page.getByRole('heading', { name: topic.topicUz || topic.topic, exact: true })).toBeVisible();
});

test('today conversation remains visible through a slow reload', async ({ page }) => {
  await setup(page, {
    'getMe(undefined)': query('getMe', user),
    'getSpeakToday(undefined)': query('getSpeakToday', conversation),
  });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(url => url.pathname === '/api/auth/refresh', async route => {
    await gate;
    await route.fulfill({ json: { ...user, token: 'test-token' } });
  });
  await page.goto('/');
  await expect(page.getByText('Bugungi suhbat', { exact: true })).toBeVisible();
  await expect(page.getByText('Ali', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Ali', { exact: true })).toBeVisible();
  release();
});

test('a cold conversation request reserves a visible place with retry on failure', async ({ page }) => {
  await setup(page);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(url => url.pathname === '/api/speak/today', async route => {
    await gate;
    await route.fulfill({ status: 503, json: {} });
  });
  await page.goto('/');
  await expect(page.getByLabel('Bugungi suhbat yuklanmoqda')).toBeVisible();
  release();
  await expect(page.getByText("Suhbatni yuklab bo'lmadi", { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Qayta urinish', exact: true })).toBeVisible();
});

test('new phrases cannot replace a word answer before its result and next button', async ({ page }) => {
  await setup(page);
  let checked = false;
  await page.route(url => url.pathname === '/api/review/due', route => route.fulfill({ json: [
    { _id: 'word1', mode: 'recognize', word: 'apple', options: ['olma', 'suv'] },
    { _id: 'word2', mode: 'recognize', word: 'water', options: ['olma', 'suv'] },
  ] }));
  await page.route(url => url.pathname === '/api/review/phrases/due', route => route.fulfill({ json: checked
    ? [{ _id: 'phrase1', textUz: 'Men olma yeyman.', stage: 0 }] : [] }));
  await page.route(url => url.pathname === '/api/review/word1/check', route => {
    checked = true;
    return route.fulfill({ json: { isCorrect: true, correctAnswer: 'olma', intervalDays: 1 } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '1 olma', exact: true }).click();
  await expect(page.getByRole('button', { name: "Keyingi so'z", exact: true })).toBeVisible();
  await expect(page.getByText('Men olma yeyman.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: "Keyingi so'z", exact: true }).click();
  await expect(page.getByRole('heading', { name: 'water', exact: true })).toBeVisible();
});

test('an expired access token plus a temporary refresh failure does not sign out', async ({ page }) => {
  await setup(page);
  let refreshes = 0;
  await page.route(url => url.pathname === '/api/auth/refresh', route => {
    refreshes++;
    return route.fulfill(refreshes === 1
      ? { json: { ...user, token: 'old-token' } } : { status: 503, json: {} });
  });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(url => url.pathname === '/api/auth/me', async route => {
    await gate;
    await route.fulfill({ status: 401, json: {} });
  });
  await page.goto('/');
  await expect(page.getByText('Bugungi suhbat', { exact: true })).toBeVisible();
  await page.clock.setFixedTime(new Date(time.getTime() + 10_000));
  release();
  await expect.poll(() => refreshes).toBeGreaterThanOrEqual(2);
  await expect(page.getByText('Bugungi suhbat', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kirish', exact: true })).toHaveCount(0);
});

test('returning after midnight hides the old scene until both daily responses arrive', async ({ page }) => {
  await setup(page);
  let tomorrow = false;
  let releaseProfile;
  let releaseTopic;
  const profileGate = new Promise(resolve => { releaseProfile = resolve; });
  const topicGate = new Promise(resolve => { releaseTopic = resolve; });
  const nextUser = { ...user, today: '2026-10-04', dailyQuests: { date: '2026-10-04' } };
  await page.route(url => url.pathname === '/api/auth/me', async route => {
    if (tomorrow) await profileGate;
    await route.fulfill({ json: tomorrow ? nextUser : user });
  });
  await page.route(url => url.pathname === '/api/topics/current', async route => {
    if (tomorrow) await topicGate;
    await route.fulfill({ json: { ...topic, topicUz: tomorrow ? 'Yangi sahna' : 'Eski sahna', dayKey: tomorrow ? nextUser.today : user.today, words: topic.words.slice(0, 5) } });
  });
  await page.goto('/topic');
  await expect(page.getByRole('heading', { name: 'Eski sahna', exact: true })).toBeVisible();
  tomorrow = true;
  await page.clock.setFixedTime(new Date('2026-10-03T19:00:00Z'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByText('Bugungi kun yuklanmoqda…', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Eski sahna', exact: true })).toHaveCount(0);
  releaseProfile();
  await expect(page.getByText('Bugungi kun yuklanmoqda…', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Eski sahna', exact: true })).toHaveCount(0);
  releaseTopic();
  await expect(page.getByRole('heading', { name: 'Yangi sahna', exact: true })).toBeVisible();
});

test('a failed option check keeps the answer available for an explicit retry', async ({ page }) => {
  await setup(page);
  await page.route(url => url.pathname === '/api/review/due', route => route.fulfill({ json: [
    { _id: 'word1', mode: 'recognize', word: 'apple', options: ['olma', 'suv'] },
  ] }));
  let attempts = 0;
  await page.route(url => url.pathname === '/api/review/word1/check', route => {
    attempts++;
    return route.fulfill(attempts === 1 ? { status: 503, json: {} }
      : { json: { isCorrect: true, correctAnswer: 'olma', intervalDays: 1 } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '1 olma', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Javobingiz saqlanib qoldi');
  await page.getByRole('button', { name: 'Javobni qayta yuborish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Yakunlash', exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});

test('daily pages use the refreshed profile timezone when it differs from the login profile', async ({ page }) => {
  await setup(page);
  await page.clock.setFixedTime(new Date('2026-10-03T02:00:00Z'));
  const updatedUser = { ...user, timezone: 'America/Los_Angeles', today: '2026-10-02', dailyQuests: { date: '2026-10-02' } };
  await page.route(url => url.pathname === '/api/auth/me', route => route.fulfill({ json: updatedUser }));
  await page.route(url => url.pathname === '/api/topics/current', route => route.fulfill({ json: {
    ...topic, dayKey: updatedUser.today, words: topic.words.slice(0, 5),
  } }));
  await page.route(url => url.pathname === '/api/speak/today', route => route.fulfill({ json: {
    ...conversation, dayKey: updatedUser.today,
  } }));
  await page.goto('/topic');
  await expect(page.getByRole('heading', { name: topic.topicUz || topic.topic, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Suhbat', exact: true }).first().click();
  await expect(page.getByText('Ali', { exact: true })).toBeVisible();
});

test('an option request that never responds times out and can be retried', async ({ page }) => {
  await setup(page);
  await page.clock.install({ time });
  await page.route(url => url.pathname === '/api/review/due', route => route.fulfill({ json: [
    { _id: 'word1', mode: 'recognize', word: 'apple', options: ['olma', 'suv'] },
  ] }));
  let attempts = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(url => url.pathname === '/api/review/word1/check', async route => {
    attempts++;
    if (attempts === 1) await gate;
    await route.fulfill({ json: { isCorrect: true, correctAnswer: 'olma', intervalDays: 1 } });
  });
  await page.goto('/');
  await page.getByRole('button', { name: '1 olma', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Javob tekshirilmoqda…' })).toBeVisible();
  await page.clock.runFor(20_100);
  await expect(page.getByRole('button', { name: 'Javobni qayta yuborish', exact: true })).toBeVisible();
  release();
  await page.getByRole('button', { name: 'Javobni qayta yuborish', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Yakunlash', exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});
