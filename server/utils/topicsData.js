const fs = require('fs');
const path = require('path');

const topicsDataPath = path.join(__dirname, '../data/topics.json');
const cache = { data: null, mtime: 0 };

/** Kurs sahnalari (data/topics.json) — fayl o'zgarmaguncha keshdan */
const loadTopics = () => {
  const stat = fs.statSync(topicsDataPath);
  if (cache.data && cache.mtime === stat.mtimeMs) return cache.data;
  cache.data = JSON.parse(fs.readFileSync(topicsDataPath, 'utf8'));
  cache.mtime = stat.mtimeMs;
  return cache.data;
};

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * Kursdagi CEFR yo'li: foydalanuvchi qaysi darajada va shu darajaning
 * qancha sahnasini o'tgan.
 *
 * XP/"Lv" o'rniga: "Lv.7" hech narsani anglatmaydi, "B1 · 12/36 sahna"
 * esa aniq — qayerdasiz va keyingi darajagacha qancha qoldi.
 *
 * @param {Array<{day:number,cefr:string}>} topicsList
 * @param {number} currentDay — keyingi o'tiladigan kun (TopicProgress.currentDay)
 */
const computeCourseProgress = (topicsList, currentDay) => {
  const list = Array.isArray(topicsList) ? topicsList : [];
  const day = Math.max(1, Number(currentDay) || 1);
  const finished = list.length > 0 && day > list.length;
  const current = list.find((t) => t.day === Math.min(day, list.length)) || list[0];
  const cefr = current?.cefr || 'A1';

  const band = list.filter((t) => t.cefr === cefr);
  const done = finished ? band.length : band.filter((t) => t.day < day).length;
  const levels = CEFR_ORDER.filter((c) => list.some((t) => t.cefr === c));
  const nextCefr = levels[levels.indexOf(cefr) + 1] || null;

  return {
    cefr,
    nextCefr,
    done,
    total: band.length,
    percent: band.length ? Math.round((done / band.length) * 100) : 0,
    daysCompleted: Math.min(day - 1, list.length),
    totalDays: list.length,
    finished,
  };
};

module.exports = { loadTopics, computeCourseProgress, CEFR_ORDER };
