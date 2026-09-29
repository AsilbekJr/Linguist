const Word = require('../models/Word');
const TopicProgress = require('../models/TopicProgress');
const { enrichUserProfile } = require('./gamification');
const { loadTopics, computeCourseProgress } = require('./topicsData');

/**
 * Mijozga qaytariladigan to'liq profil. Foydalanuvchini qaytaradigan har bir
 * endpoint shuni ishlatadi — aks holda mijoz keshidagi profil bir so'rovdan
 * keyin `knownWords`/`course` maydonlarisiz qolib ketardi.
 */
const buildUserProfile = async (user) => {
  const [totalWords, knownWords, progress] = await Promise.all([
    Word.countDocuments({ user: user._id }),
    Word.countDocuments({ user: user._id, learned: true }),
    TopicProgress.findOne({ user: user._id }).select('currentDay').lean(),
  ]);
  return enrichUserProfile(user, {
    totalWords,
    knownWords,
    course: computeCourseProgress(loadTopics(), progress?.currentDay || 1),
  });
};

module.exports = { buildUserProfile };
