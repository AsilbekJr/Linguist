const PLAN_LIMITS = {
  free: 15,
  pro: 200,
  premium: Infinity,
};

const resetUsageIfNewDay = (user) => {
  const today = new Date().toISOString().split('T')[0];
  if (user.usage?.aiCallsDate !== today) {
    user.usage = { aiCallsToday: 0, aiCallsDate: today };
  }
};

const getAiLimit = (user) => {
  if (process.env.NODE_ENV !== 'production') {
    return 500;
  }
  const plan = user.getEffectivePlan();
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
};

/** Faqat limitni tekshiradi (AI chaqiruvdan oldin) */
const checkAiQuota = async (req, res, next) => {
  try {
    resetUsageIfNewDay(req.user);
    const limit = getAiLimit(req.user);
    if (req.user.usage.aiCallsToday >= limit) {
      return res.status(402).json({
        message: 'Kunlik AI limiti tugadi. Pro tarifga o\'ting.',
        code: 'AI_QUOTA_EXCEEDED',
        plan: req.user.getEffectivePlan(),
        limit,
      });
    }
    next();
  } catch (error) {
    console.error('Usage quota check error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Muvaffaqiyatli AI javobdan keyin hisobga yozadi */
const recordAiUsage = async (user) => {
  resetUsageIfNewDay(user);
  user.usage.aiCallsToday += 1;
  await user.save();
};

/** Boshqa routelar — limit + darhol hisobga yozish */
const trackAiUsage = async (req, res, next) => {
  try {
    resetUsageIfNewDay(req.user);
    const limit = getAiLimit(req.user);
    if (req.user.usage.aiCallsToday >= limit) {
      return res.status(402).json({
        message: 'Kunlik AI limiti tugadi. Pro tarifga o\'ting.',
        code: 'AI_QUOTA_EXCEEDED',
        plan: req.user.getEffectivePlan(),
        limit,
      });
    }
    req.user.usage.aiCallsToday += 1;
    await req.user.save();
    next();
  } catch (error) {
    console.error('Usage quota error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  trackAiUsage,
  checkAiQuota,
  recordAiUsage,
  PLAN_LIMITS,
  resetUsageIfNewDay,
};
