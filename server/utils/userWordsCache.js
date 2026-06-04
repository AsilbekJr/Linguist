const { LRUCache } = require('lru-cache');

const cache = new LRUCache({ max: 400, ttl: 1000 * 60 });

const getSavedWordList = async (userId, loader) => {
  const key = String(userId);
  const hit = cache.get(key);
  if (hit) return hit;
  const list = await loader();
  cache.set(key, list);
  return list;
};

const invalidateUserWords = (userId) => {
  cache.delete(String(userId));
};

module.exports = { getSavedWordList, invalidateUserWords };
