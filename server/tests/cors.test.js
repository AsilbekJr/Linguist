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

// ── Preview shabloni ──────────────────────────────────────────────────────

const { compileOriginPattern, isOriginAllowed } = require('../utils/corsConfig');

const PREVIEW_PATTERN =
  '^https://linguist-git-[a-z0-9-]+-asilbekjrs-projects\\.vercel\\.app$';

test('to\'g\'ri yozilgan preview shabloni qabul qilinadi', () => {
  const regex = compileOriginPattern(PREVIEW_PATTERN);
  assert.ok(regex, 'shablon rad etildi');
  assert.equal(
    regex.test('https://linguist-git-fix-phase-0-critical-asilbekjrs-projects.vercel.app'),
    true
  );
  assert.equal(regex.test('https://linguist-git-another-branch-asilbekjrs-projects.vercel.app'), true);
});

test('shablon begona manzillarga mos kelmaydi', () => {
  const regex = compileOriginPattern(PREVIEW_PATTERN);
  for (const bad of [
    'https://evil.example',
    'https://attacker.vercel.app',
    'https://linguist-git-x-someoneelse-projects.vercel.app',
    'http://linguist-git-x-asilbekjrs-projects.vercel.app', // http
    'https://linguist-git-x-asilbekjrs-projects.vercel.app.evil.com',
  ]) {
    assert.equal(regex.test(bad), false, `begona manzil o'tdi: ${bad}`);
  }
});

test('bog\'lanmagan shablon RAD ETILADI', () => {
  // ^ va $ bo'lmasa "https://evil.com/linguist-git-..." ham mos kelib qolardi
  assert.equal(compileOriginPattern('https://.*\\.vercel\\.app'), null);
  assert.equal(compileOriginPattern('^https://.*\\.vercel\\.app'), null, '$ yo\'q');
  assert.equal(compileOriginPattern('https://.*\\.vercel\\.app$'), null, '^ yo\'q');
});

test('haddan tashqari keng shablon RAD ETILADI', () => {
  assert.equal(compileOriginPattern('^.*$'), null);
  assert.equal(compileOriginPattern('^.+$'), null);
  assert.equal(compileOriginPattern('^https://.*$'), null, 'har qanday https o\'tib ketardi');
});

test('yaroqsiz regex xato bermaydi, shunchaki o\'chiq qoladi', () => {
  assert.equal(compileOriginPattern('^https://[unclosed$'), null);
  assert.equal(compileOriginPattern(''), null);
  assert.equal(compileOriginPattern(undefined), null);
});

test('isOriginAllowed ro\'yxat va shablonni birga tekshiradi', () => {
  withEnv(
    {
      ALLOWED_ORIGIN: 'https://linguist-eight.vercel.app',
      CLIENT_URL: '',
      ALLOWED_ORIGIN_PATTERN: PREVIEW_PATTERN,
    },
    () => {
      assert.equal(isOriginAllowed('https://linguist-eight.vercel.app', true), true, 'ro\'yxatdan');
      assert.equal(
        isOriginAllowed('https://linguist-git-abc-asilbekjrs-projects.vercel.app', true),
        true,
        'shablondan'
      );
      assert.equal(isOriginAllowed('https://evil.example', true), false);
      assert.equal(isOriginAllowed(null, true), true, 'originsiz so\'rov (curl)');
    }
  );
});

test('shablon sozlanmagan bo\'lsa faqat ro\'yxat ishlaydi', () => {
  withEnv(
    { ALLOWED_ORIGIN: 'https://linguist-eight.vercel.app', CLIENT_URL: '', ALLOWED_ORIGIN_PATTERN: '' },
    () => {
      assert.equal(
        isOriginAllowed('https://linguist-git-abc-asilbekjrs-projects.vercel.app', true),
        false
      );
    }
  );
});

test('ALLOWED_ORIGIN va CLIENT_URL birlashadi, dublikat bo\'lmaydi', () => {
  withEnv(
    { ALLOWED_ORIGIN: 'https://a.uz', CLIENT_URL: 'https://a.uz' },
    () => {
      assert.deepEqual(getAllowedOrigins(true), ['https://a.uz']);
    }
  );
});
