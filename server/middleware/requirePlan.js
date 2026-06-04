const requirePlan = (...allowedPlans) => (req, res, next) => {
  const plan = req.user?.getEffectivePlan?.() || 'free';
  if (!allowedPlans.includes(plan)) {
    return res.status(403).json({
      message: 'Bu funksiya pullik tarifda mavjud.',
      code: 'PLAN_REQUIRED',
      requiredPlans: allowedPlans,
      currentPlan: plan,
    });
  }
  next();
};

module.exports = { requirePlan };
