const { LRUCache } = require('lru-cache');

const dictionaryCache = new LRUCache({
  max: 5000,
  ttl: 1000 * 60 * 60 * 24 * 7,
});

const geminiResponseCache = new LRUCache({
  max: 400,
  ttl: 1000 * 60 * 60 * 2,
});

let topicsCache = { data: null, loadedAt: 0, mtime: 0 };

const getDictionaryEntry = (word, loader) => {
  const key = word.toLowerCase();
  const hit = dictionaryCache.get(key);
  if (hit) return hit;
  const entry = loader();
  if (entry) dictionaryCache.set(key, entry);
  return entry;
};

const getGeminiCached = (key) => geminiResponseCache.get(key);

const setGeminiCached = (key, value) => {
  if (value != null) geminiResponseCache.set(key, value);
};

module.exports = {
  dictionaryCache,
  geminiResponseCache,
  topicsCache,
  getDictionaryEntry,
  getGeminiCached,
  setGeminiCached,
};
