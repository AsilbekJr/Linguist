#!/usr/bin/env node
/**
 * PWA sanity-tekshiruvi (build'dan oldin ishlaydi).
 *
 * Bu yerdagi eng muhim tekshiruv — service worker API javoblarini
 * KESHLAMASLIGI. Agar kimdir shu himoyani olib tashlasa:
 *  - umumiy qurilmada bir foydalanuvchining javobi boshqasiga ko'rinishi,
 *  - eskirgan progress SRS jadvalini chalkashtirib yuborishi mumkin.
 * Bunday xatoni qo'lda sinovda payqash deyarli imkonsiz, shuning uchun
 * build vaqtida tekshiriladi.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');

const problems = [];
const ok = [];

// ── Manifest ───────────────────────────────────────────────────────────────
const manifestPath = path.join(publicDir, 'manifest.webmanifest');
if (!fs.existsSync(manifestPath)) {
  problems.push('manifest.webmanifest topilmadi');
} else {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    ok.push('manifest JSON yaroqli');
  } catch (err) {
    problems.push(`manifest JSON buzuq: ${err.message}`);
  }

  if (manifest) {
    for (const field of ['name', 'short_name', 'start_url', 'display', 'icons', 'theme_color']) {
      if (!manifest[field]) problems.push(`manifest: "${field}" yo'q`);
    }
    if (manifest.display !== 'standalone') {
      problems.push(`manifest: display "standalone" bo'lishi kerak (hozir "${manifest.display}")`);
    }

    const sizes = (manifest.icons || []).map((i) => i.sizes);
    if (!sizes.includes('192x192')) problems.push('manifest: 192x192 ikonka yo\'q');
    if (!sizes.includes('512x512')) problems.push('manifest: 512x512 ikonka yo\'q');
    if (!(manifest.icons || []).some((i) => i.purpose === 'maskable')) {
      // Androidda maskable bo'lmasa ikonka oq kvadrat ichida ko'rinadi
      problems.push('manifest: maskable ikonka yo\'q — Androidda yomon ko\'rinadi');
    }

    for (const icon of manifest.icons || []) {
      const file = path.join(publicDir, icon.src.replace(/^\//, ''));
      if (!fs.existsSync(file)) {
        problems.push(`ikonka fayli yo'q: ${icon.src}`);
      } else {
        const head = fs.readFileSync(file).subarray(0, 8).toString('hex');
        if (head !== '89504e470d0a1a0a') {
          problems.push(`${icon.src} yaroqli PNG emas`);
        }
      }
    }
    if (!problems.length) ok.push(`${(manifest.icons || []).length} ta ikonka joyida`);
  }
}

// ── Service worker ─────────────────────────────────────────────────────────
const swPath = path.join(publicDir, 'sw.js');
if (!fs.existsSync(swPath)) {
  problems.push('sw.js topilmadi');
} else {
  const raw = fs.readFileSync(swPath, 'utf8');

  /**
   * Izohlarni olib tashlaymiz.
   *
   * Busiz tekshiruv soxta ijobiy beradi: izoh ichida xatoli namunani
   * tushuntirish uchun yozilgan matn ham "kod" deb hisoblanardi. Aynan
   * shu holat yuz berdi — `.catch(() => cached)` izohda eslatilgani uchun
   * tuzatilgan fayl "buzuq" deb belgilandi.
   */
  const sw = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  // Eng muhim tekshiruv: API so'rovlari keshdan chetlab o'tilishi kerak
  const hasApiGuard = /isApiRequest|\/api\//.test(sw) && /return;/.test(sw);
  if (!hasApiGuard) {
    problems.push(
      "sw.js: API so'rovlarini keshlashdan himoya topilmadi. " +
        "Foydalanuvchi ma'lumotini keshlash xavfli."
    );
  } else {
    ok.push("API so'rovlari keshlanmaydi");
  }

  if (!/self\.skipWaiting/.test(sw)) {
    problems.push('sw.js: skipWaiting yo\'q — foydalanuvchi eski versiyada qolib ketadi');
  }
  if (!/caches\.delete/.test(sw)) {
    problems.push('sw.js: eski keshlarni tozalash yo\'q — disk to\'lib boradi');
  }
  if (!/request\.method !== 'GET'/.test(sw)) {
    problems.push('sw.js: faqat GET keshlanishi tekshirilmagan');
  }

  /**
   * `respondWith` ga undefined uzatilsa brauzer
   * "TypeError: Failed to convert value to 'Response'" beradi va so'rov
   * BUTUNLAY uziladi. Bu real xato edi: `.catch(() => cached)` kesh bo'sh
   * bo'lganda undefined qaytarardi.
   */
  if (/\.catch\(\(\)\s*=>\s*cached\)/.test(sw)) {
    problems.push(
      "sw.js: `.catch(() => cached)` — kesh bo'sh bo'lsa undefined qaytadi va " +
        "respondWith uziladi. Har doim Response qaytaring."
    );
  }
  if (!/new Response\([\s\S]*?504|statusText: 'Offline'/.test(sw)) {
    problems.push("sw.js: tarmoq xatosida zaxira Response yo'q");
  }
  if (!/redirected/.test(sw)) {
    problems.push(
      "sw.js: yo'naltirilgan javob keshlanishidan himoya yo'q " +
        '(Vercel SSO/Deployment Protection keshni buzadi)'
    );
  }

  if (!problems.length) ok.push('sw.js himoyalari joyida');
}

// ── index.html ─────────────────────────────────────────────────────────────
const htmlPath = path.join(__dirname, '../index.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  if (!/rel="manifest"/.test(html)) problems.push('index.html: manifest havolasi yo\'q');
  if (!/name="theme-color"/.test(html)) problems.push('index.html: theme-color yo\'q');
  if (!/apple-touch-icon/.test(html)) {
    problems.push('index.html: apple-touch-icon yo\'q — iOS\'da ikonka ko\'rinmaydi');
  }
  if (!/lang="uz"/.test(html)) problems.push('index.html: lang="uz" emas');
  if (!/name="description"/.test(html)) problems.push('index.html: meta description yo\'q');
  if (!problems.length) ok.push('index.html teglari joyida');
}

// ── Natija ─────────────────────────────────────────────────────────────────
console.log('\nPWA tekshiruvi');
for (const line of ok) console.log(`  ✓ ${line}`);

if (problems.length) {
  console.error(`\n  ${problems.length} ta muammo:`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.error('');
  process.exit(1);
}
console.log('');
