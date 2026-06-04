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

const trackAiUsage = async (req, res, next) => {
  try {
    resetUsageIfNewDay(req.user);
    const plan = req.user.getEffectivePlan();
    const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

    if (req.user.usage.aiCallsToday >= limit) {
      return res.status(402).json({
        message: 'Kunlik AI limiti tugadi. Pro tarifga o\'ting.',
        code: 'AI_QUOTA_EXCEEDED',
        plan,
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

module.exports = { trackAiUsage, PLAN_LIMITS, resetUsageIfNewDay };
