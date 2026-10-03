import { entriesToPrune } from '../utils/diaryLogic';

/**
 * Ovoz kundaligi ombori — FAQAT shu qurilmada (IndexedDB).
 *
 * Audio serverga yuborilmaydi: ilgari "100 kunlik challenge" yozuvlarni
 * base64 qilib bazaga yozardi — bu ham maxfiylik, ham Render diskidagi joy
 * muammosi edi. Kamchiligi: brauzer ma'lumoti tozalansa yozuvlar yo'qoladi,
 * shuning uchun har yozuvni yuklab olish mumkin.
 */
const DB_NAME = 'linguist-voice';
const STORE = 'entries';
const VERSION = 1;

let dbPromise = null;

const openDb = () => {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB yo\'q'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
};

const tx = async (mode, fn) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const result = fn(store);
    t.oncomplete = () => resolve(result?.result ?? result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
};

/** @returns {Promise<Array<{id, kind, dayKey, text, textUz, blob, mimeType, durationMs, createdAt}>>} */
export const listEntries = async () => {
  try {
    const all = await tx('readonly', (s) => s.getAll());
    return Array.isArray(all) ? all : [];
  } catch {
    return [];
  }
};

export const addEntry = async (entry) => {
  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    ...entry,
  };
  await tx('readwrite', (s) => s.put(record));
  // Eski kunlik iboralar — joy to'lmasin
  const prune = entriesToPrune(await listEntries());
  if (prune.length) await tx('readwrite', (s) => prune.forEach((id) => s.delete(id)));
  return record;
};

export const deleteEntry = (id) => tx('readwrite', (s) => s.delete(id));

/** Kundalik o'zgarganda ochiq sahifalar yangilansin */
export const DIARY_EVENT = 'linguist:voice-diary';
export const notifyDiaryChanged = () => {
  try {
    window.dispatchEvent(new Event(DIARY_EVENT));
  } catch {
    // muhim emas
  }
};
