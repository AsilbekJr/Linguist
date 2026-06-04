const { LRUCache } = require('lru-cache');

const dictionaryCache = new LRUCache({
  max: 5000,
  ttl: 1000 * 60 * 60 * 24 * 7,
});

const geminiResponseCache = new LRUCache({
  max: 200,
  ttl: 1000 * 60 * 60,
});

let topicsCache = { data: null, loadedAt: 0, mtime: 0 };

const getCached = (cache, key) => cache.get(key);

const setCached = (cache, key, value) => cache.set(key, value);

const getDictionaryEntry = (word, loader) => {
  const key = word.toLowerCase();
  const hit = dictionaryCache.get(key);
  if (hit) return hit;
  const entry = loader();
  if (entry) dictionaryCache.set(key, entry);
  return entry;
};

const getGeminiCached = (key, fetcher) => {
  const hit = geminiResponseCache.get(key);
  if (hit) return hit;
  return null;
};

const setGeminiCached = (key, value) => {
  if (value) geminiResponseCache.set(key, value);
};

module.exports = {
  dictionaryCache,
  geminiResponseCache,
  topicsCache,
  getCached,
  setCached,
  getDictionaryEntry,
  getGeminiCached,
  setGeminiCached,
};
