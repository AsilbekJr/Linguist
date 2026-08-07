const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getAllowedOrigins,
  normalizeOrigin,
  parseOrigins,
  isValidOrigin,
} = require('../utils/corsConfig');

/**
 * CORS sozlamalari deploydan keyingi eng ko'p uchraydigan nosozlik sababi.
 * Brauzerda u shunchaki "Failed to fetch" bo'lib ko'rinadi va sababini
 * topish qiyin, shuning uchun mantiq test bilan qamrab olingan.
 */

const withEnv = (env, fn) => {
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try {
    return fn();
  } finally {
    for (const key of Object.keys(env)) delete process.env[key];
    Object.assign(process.env, saved);
  }
};

test('production da faqat aniq yozilgan originlar ruxsat etiladi', () => {
  withEnv({ ALLOWED_ORIGIN: 'https://app.example.uz', CLIENT_URL: '' }, () => {
    const origins = getAllowedOrigins(true);
    assert.deepEqual(origins, ['https://app.example.uz']);
    assert.ok(!origins.includes('http://localhost:5173'), 'prod da localhost bo\'lmasligi kerak');
  });
});

test('bir nechta origin vergul bilan yoziladi — preview URL qo\'shish uchun', () => {
  withEnv(
    {
      ALLOWED_ORIGIN: 'https://app.example.uz, https://preview-git-branch.vercel.app',
      CLIENT_URL: '',
    },
    () => {
      const origins = getAllowedOrigins(true);
      assert.equal(origins.length, 2);
      assert.ok(origins.includes('https://preview-git-branch.vercel.app'));
    }
  );
});

test('dev da localhost avtomatik qo\'shiladi', () => {
  withEnv({ ALLOWED_ORIGIN: '', CLIENT_URL: '' }, () => {
    const origins = getAllowedOrigins(false);
    assert.ok(origins.includes('http://localhost:5173'));
    assert.ok(origins.includes('http://127.0.0.1:5173'));
  });
});

test('oxiridagi slash va keng tarqalgan terish xatosi tuzatiladi', () => {
  assert.equal(normalizeOrigin('https://app.example.uz/'), 'https://app.example.uz');
  assert.equal(normalizeOrigin('https//app.example.uz'), 'https://app.example.uz');
  assert.equal(normalizeOrigin('  https://app.example.uz  '), 'https://app.example.uz');
});

test('* rad etiladi — cookie bilan CORS uni qabul qilmaydi', () => {
  assert.deepEqual(parseOrigins('*'), []);
  assert.deepEqual(parseOrigins('https://a.uz, *'), ['https://a.uz']);
});

test('yaroqsiz origin aniqlanadi', () => {
  assert.equal(isValidOrigin('https://a.uz'), true);
  assert.equal(isValidOrigin('http://localhost:5173'), true);
  assert.equal(isValidOrigin('app.example.uz'), false, 'protokolsiz');
  assert.equal(isValidOrigin('ftp://a.uz'), false);
  assert.equal(isValidOrigin(''), false);
});

test('ALLOWED_ORIGIN va CLIENT_URL birlashadi, dublikat bo\'lmaydi', () => {
  withEnv(
    { ALLOWED_ORIGIN: 'https://a.uz', CLIENT_URL: 'https://a.uz' },
    () => {
      assert.deepEqual(getAllowedOrigins(true), ['https://a.uz']);
    }
  );
});
