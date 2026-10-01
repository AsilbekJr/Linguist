const fs = require('fs');
const path = require('path');
const TopicProgress = require('../models/TopicProgress');
const { topicsCache } = require('./cache');
const { userDayKey } = require('./dayKey');
const { getDailyWordTarget, resolveTopicDay } = require('./topicHelpers');

/**
 * Bugungi kun konteksti — kunlik sahna va Suhbat bir xil sahnaga tayanadi,
 * shuning uchun hisob bitta joyda. (Ilgari topicVocabRoutes ichida edi.)
 */
const topicsDataPath = path.join(__dirname, '../data/topics.json');

const loadTopicsData = () => {
  const stat = fs.statSync(topicsDataPath);
  if (topicsCache.data && topicsCache.mtime === stat.mtimeMs) {
    return topicsCache.data;
  }
  const data = JSON.parse(fs.readFileSync(topicsDataPath, 'utf8'));
  topicsCache.data = data;
  topicsCache.mtime = stat.mtimeMs;
  topicsCache.loadedAt = Date.now();
  return data;
};

/** Foydalanuvchining bugungi kontekstini bir joyda hisoblash */
const resolveDailyContext = async (user) => {
  let progress = await TopicProgress.findOne({ user: user._id });
  if (!progress) {
    progress = await TopicProgress.create({ user: user._id, currentDay: 1, history: [] });
  }

  const topicsList = loadTopicsData();
  const learnerLevel = user.onboarding?.level || 'beginner';
  const wordTarget = getDailyWordTarget(user.onboarding);
  const todayKey = userDayKey(user);

  const latest = progress.history.length ? progress.history[progress.history.length - 1] : null;
  const isCompleteForToday = latest
    ? userDayKey(user, new Date(latest.completedAt)) === todayKey
    : false;

  const logicalDay = isCompleteForToday ? Math.max(1, progress.currentDay - 1) : progress.currentDay;
  const contentDay = resolveTopicDay(logicalDay, topicsList);
  const baseTopic = topicsList.find((t) => t.day === contentDay);

  return {
    progress,
    topicsList,
    learnerLevel,
    wordTarget,
    todayKey,
    isCompleteForToday,
    logicalDay,
    contentDay,
    baseTopic,
    isFinished: progress.currentDay > topicsList.length,
  };
};

module.exports = { loadTopicsData, resolveDailyContext };
