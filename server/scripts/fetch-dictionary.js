#!/usr/bin/env node
/**
 * Lug'at snapshoti: dictionaryapi.dev  →  data/dictionary-snapshot.json
 *
 * Nega bu skript bor:
 * Ilgari `api.dictionaryapi.dev` ga MUROJAAT RUNTIME'DA qilinardi — foydalanuvchi
 * so'z qo'shganda (`routes/wordRoutes.js`). Bu uchta muammo tug'diradi:
 *
 *  1. Kurrikulumdagi 300 so'z hamma foydalanuvchida bir xil, lekin har biri
 *     uchun har safar tashqi so'rov ketardi — bepul, SLA'siz, kalitsiz API'ga.
 *  2. API o'chsa yoki sekinlashsa, ilovaning asosiy oqimi ham sekinlashardi.
 *  3. Kontent validatori (`content/schema.js`) IPA va partOfSpeech ni tekshira
 *     olmasdi — solishtiradigan manba yo'q edi.
 *
 * Snapshot uchalasini ham hal qiladi: ma'lumot build vaqtida bir marta olinadi,
 * repoga tushadi va runtime'da fayldan o'qiladi.
 *
 *   npm run dict:fetch                # yangi so'zlarni oladi (inkremental)
 *   npm run dict:fetch -- --force     # hammasini qaytadan oladi
 *   npm run dict:fetch -- resilient   # kurrikulumdan tashqari so'z qo'shadi
 *
 * Fayl repoga KOMMIT QILINADI — deploy paytida tarmoq talab qilinmaydi.
 */

const fs = require('fs');
const path = require('path');

const API = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const TOPICS_PATH = path.join(__dirname, '../data/topics.json');
const OUT_PATH = path.join(__dirname, '../data/dictionary-snapshot.json');

// ─── Hajm cheklovlari ────────────────────────────────────────────────────────
//
// Wiktionary ba'zi so'zlarga 20+ ta ma'no beradi ("set" uchun 100 dan ortiq).
// Cheklovsiz snapshot bir necha MB bo'lardi va git diff'i o'qib bo'lmas edi.
// Bizga o'quv maqsadida faqat eng ko'p ishlatiladigan ma'nolar kerak.
const MAX_MEANINGS = 4;
const MAX_DEFS_PER_MEANING = 3;
const MAX_SYNONYMS = 8;
const MAX_AUDIO = 3;

// ─── Tarmoq siyosati ─────────────────────────────────────────────────────────
//
// dictionaryapi.dev bepul va rate limit'i e'lon qilinmagan. Tajribada
// 4 parallel × 250 ms 300 so'zning ~15% ida 429 qaytardi, 2 × 400 ms esa
// toza o'tdi. Skript kuniga bir marta ishlaydi — tezlikni quvish ma'nosiz.
const CONCURRENCY = 2;
const BATCH_DELAY_MS = 400;
const TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;
/** 429 uchun alohida, uzunroq kutish — umumiy backoff yetarli emas */
const RATE_LIMIT_BACKOFF_MS = 3000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const trimList = (list, max) =>
  [...new Set((list || []).map((s) => String(s).trim()).filter(Boolean))].slice(0, max);

/**
 * To'liq so'z transkripsiyasimi?
 *
 * Wiktionary ba'zan faqat farq qiladigan QISMNI beradi: "environment" uchun
 * yagona yozuv `/-mɪnt/`. Bunday satr na foydalanuvchiga ko'rsatishga, na
 * validatorda solishtirishga yaroqli — u kurrikulumdagi to'g'ri IPA'ni
 * "9 belgiga farq qiladi" deb ayblab, soxta ogohlantirish bergan edi.
 */
const isFullTranscription = (text) => {
  const t = String(text || '').trim();
  if (!t) return false;
  const inner = t.replace(/^[/[]+|[/\]]+$/g, '');
  return Boolean(inner) && !inner.startsWith('-') && !inner.endsWith('-');
};

/**
 * API javobidan bizga keraklisini ajratib oladi.
 *
 * Bir so'z bir nechta `entry` bilan qaytishi mumkin (omonimlar: "bow" — ta'zim
 * va kamon). Ularni bitta yozuvga birlashtiramiz: foydalanuvchi uchun bu bitta
 * so'z, va SRS ham uni bitta kartochka deb biladi.
 */
const normalizeEntry = (word, data) => {
  const entries = Array.isArray(data) ? data : [];
  const phonetics = [];
  const audio = [];
  const meanings = [];
  const sourceUrls = [];

  for (const entry of entries) {
    if (isFullTranscription(entry.phonetic)) phonetics.push(entry.phonetic);
    for (const p of entry.phonetics || []) {
      if (isFullTranscription(p.text)) phonetics.push(p.text);
      if (p.audio) audio.push(p.audio);
    }
    for (const m of entry.meanings || []) {
      if (!m.partOfSpeech) continue;
      const definitions = (m.definitions || [])
        .filter((d) => d.definition)
        .slice(0, MAX_DEFS_PER_MEANING)
        .map((d) => {
          const out = { definition: String(d.definition).trim() };
          if (d.example) out.example = String(d.example).trim();
          const syn = trimList(d.synonyms, MAX_SYNONYMS);
          if (syn.length) out.synonyms = syn;
          return out;
        });
      if (!definitions.length) continue;

      // Bir xil partOfSpeech bir nechta entry'da uchrashi mumkin — birlashtiramiz
      const existing = meanings.find((x) => x.partOfSpeech === m.partOfSpeech);
      const target = existing || { partOfSpeech: m.partOfSpeech, definitions: [] };
      target.definitions = target.definitions.concat(definitions).slice(0, MAX_DEFS_PER_MEANING);
      target.synonyms = trimList([...(target.synonyms || []), ...(m.synonyms || [])], MAX_SYNONYMS);
      target.antonyms = trimList([...(target.antonyms || []), ...(m.antonyms || [])], MAX_SYNONYMS);
      if (!target.synonyms.length) delete target.synonyms;
      if (!target.antonyms.length) delete target.antonyms;
      if (!existing) meanings.push(target);
    }
    for (const u of entry.sourceUrls || []) sourceUrls.push(u);
  }

  return {
    word,
    phonetics: trimList(phonetics, 6),
    audio: trimList(audio, MAX_AUDIO),
    meanings: meanings.slice(0, MAX_MEANINGS),
    sourceUrls: trimList(sourceUrls, 3),
  };
};

/**
 * Bitta so'zni oladi.
 * @returns {{ok: true, entry: object} | {ok: true, notFound: true} | {ok: false, error: string}}
 */
const fetchWord = async (word) => {
  let lastError = 'noma\'lum xato';
  let backoff = 500;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(backoff);
      backoff *= 2;
    }

    try {
      const res = await fetch(`${API}/${encodeURIComponent(word)}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: 'application/json' },
      });

      // 404 = bunday so'z yo'q. Bu XATO EMAS, javobning o'zi — keshlaymiz,
      // aks holda har build'da yana so'raladi.
      if (res.status === 404) return { ok: true, notFound: true };

      // 429/5xx — vaqtinchalik, qayta urinamiz
      if (res.status === 429 || res.status >= 500) {
        lastError = `HTTP ${res.status}`;
        if (res.status === 429) backoff = Math.max(backoff, RATE_LIMIT_BACKOFF_MS);
        continue;
      }
      if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };

      return { ok: true, entry: normalizeEntry(word, await res.json()) };
    } catch (err) {
      lastError = err.name === 'TimeoutError' ? `timeout ${TIMEOUT_MS}ms` : err.message;
    }
  }

  return { ok: false, error: lastError };
};

const loadExisting = () => {
  if (!fs.existsSync(OUT_PATH)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
    return parsed.entries || {};
  } catch (err) {
    console.warn(`Mavjud snapshot o'qilmadi (${err.message}) — noldan boshlanadi`);
    return {};
  }
};

const curriculumWords = () => {
  if (!fs.existsSync(TOPICS_PATH)) {
    console.error(`${path.relative(process.cwd(), TOPICS_PATH)} topilmadi — avval "npm run content:build".`);
    process.exit(1);
  }
  const topics = JSON.parse(fs.readFileSync(TOPICS_PATH, 'utf8'));
  const words = topics.flatMap((t) => (t.words || []).map((w) => String(w.word || '').toLowerCase().trim()));
  return [...new Set(words.filter(Boolean))].sort();
};

/** Vaqtinchalik faylga yozib rename qilamiz — yarim yozilgan JSON qolmasligi uchun */
const writeAtomic = (entries) => {
  const sorted = {};
  for (const key of Object.keys(entries).sort()) sorted[key] = entries[key];

  const payload = {
    meta: {
      source: 'https://api.dictionaryapi.dev',
      // Ma'lumot Wiktionary'dan keladi. Ta'riflarni ko'rsatganda atribusiya
      // talab qilinadi — har yozuvdagi `sourceUrls` shuning uchun saqlanadi.
      license: 'CC BY-SA 3.0 (Wiktionary)',
      generatedBy: 'npm run dict:fetch',
      generatedAt: new Date().toISOString().slice(0, 10),
      count: Object.keys(sorted).length,
    },
    entries: sorted,
  };

  const tmp = `${OUT_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, OUT_PATH);
};

const main = async () => {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const extra = args.filter((a) => !a.startsWith('--')).map((w) => w.toLowerCase().trim());

  const existing = loadExisting();
  const all = [...new Set([...curriculumWords(), ...extra])];
  const todo = force ? all : all.filter((w) => !existing[w]);

  console.log(`\nJami so'z: ${all.length}  |  snapshotda bor: ${all.length - todo.length}  |  olinadi: ${todo.length}`);
  if (!todo.length) {
    console.log('Hammasi joyida — hech narsa olinmadi.\n');
    return;
  }

  const entries = { ...existing };
  const failures = [];
  let notFound = 0;
  let done = 0;

  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const batch = todo.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((w) => fetchWord(w)));

    batch.forEach((word, j) => {
      const r = results[j];
      done++;
      if (!r.ok) {
        failures.push(`${word}: ${r.error}`);
        return;
      }
      if (r.notFound) {
        notFound++;
        entries[word] = { word, notFound: true };
        return;
      }
      entries[word] = r.entry;
    });

    process.stdout.write(`\r  ${done}/${todo.length} …`);
    if (i + CONCURRENCY < todo.length) await sleep(BATCH_DELAY_MS);
  }
  process.stdout.write('\r');

  writeAtomic(entries);

  const withAudio = Object.values(entries).filter((e) => e.audio?.length).length;
  console.log(`\n✓ Yozildi: ${path.relative(process.cwd(), OUT_PATH)}`);
  console.log(`  Yozuvlar:        ${Object.keys(entries).length}`);
  console.log(`  Audio bilan:     ${withAudio}`);
  console.log(`  Lug'atda yo'q:   ${notFound}`);

  if (failures.length) {
    // Muvaffaqiyatli qismi baribir yozildi — qayta ishga tushirish qolganini oladi.
    // Lekin exit kodi 1: CI bu holatni sezmay o'tib ketmasligi kerak.
    console.error(`\n✗ ${failures.length} ta so'z olinmadi:`);
    for (const f of failures.slice(0, 20)) console.error(`    ${f}`);
    if (failures.length > 20) console.error(`    … va yana ${failures.length - 20} ta`);
    console.error('  Qayta ishga tushiring — faqat qolganlari olinadi.\n');
    process.exit(1);
  }
  console.log('');
};

main().catch((err) => {
  console.error(`\nKutilmagan xato: ${err.stack || err.message}\n`);
  process.exit(1);
});
