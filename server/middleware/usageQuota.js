const User = require('../models/User');
const { userDayKey } = require('../utils/dayKey');

/**
 * Kunlik AI kvotasi.
 *
 * Ilgari: `req.user.usage.aiCallsToday += 1; await req.user.save()` — ikki parallel
 * so'rov ikkalasi ham eski qiymatni o'qib, ikkalasi ham limitdan o'tib ketardi.
 * Endi: shartli `$inc` — Mongo darajasida atomik, poyga yo'q.
 *
 * Ilgari: kvota AI chaqiruvdan OLDIN yechilardi — Gemini 500 qaytarsa ham
 * foydalanuvchi limitini yo'qotardi. Endi xatoda `refund()` qaytaradi.
 */

// premium "cheksiz", lekin xarajat portlab ketmasligi uchun aqlli shift:
// 2000/kun = har 43 soniyada bitta chaqiruv, 24 soat davomida.
const PLAN_LIMITS = {
  free: 15,
  pro: 200,
  premium: 2000,
};

const getAiLimit = (user) => {
  if (process.env.NODE_ENV !== 'production') {
    return Number(process.env.DEV_AI_LIMIT) || 500;
  }
  const plan = user.getEffectivePlan();
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
};

/** Atomik yangilangan qiymatlarni req.user'ga sinxronlash (save() eskisini yozib yubormasligi uchun) */
const syncInMemoryUsage = (user, usage) => {
  if (!usage) return;
  user.usage = user.usage || {};
  user.usage.aiCallsToday = usage.aiCallsToday;
  user.usage.aiCallsDate = usage.aiCallsDate;
  // mongoose bu yo'lni "o'zgargan" deb belgilamasin — DB'dagi qiymat allaqachon to'g'ri
  if (typeof user.unmarkModified === 'function') {
    user.unmarkModified('usage');
  }
};

/**
 * Bitta AI chaqiruvni band qiladi. Atomik.
 * @returns {{ ok: boolean, limit: number, used: number, plan: string }}
 */
const reserveAiCall = async (user) => {
  const today = userDayKey(user);
  const limit = getAiLimit(user);
  const plan = user.getEffectivePlan?.() || 'free';

  // 1) Kun almashgan bo'lsa hisobni nolla — faqat sana haqiqatan eski bo'lsa
  await User.updateOne(
    { _id: user._id, 'usage.aiCallsDate': { $ne: today } },
    { $set: { 'usage.aiCallsDate': today, 'usage.aiCallsToday': 0 } }
  );

  // 2) Faqat limitdan past bo'lsa +1 — shart va inkrement bitta atomik operatsiyada
  const updated = await User.findOneAndUpdate(
    {
      _id: user._id,
      'usage.aiCallsDate': today,
      'usage.aiCallsToday': { $lt: limit },
    },
    { $inc: { 'usage.aiCallsToday': 1 } },
    { new: true, projection: { usage: 1 } }
  ).lean();

  if (!updated) {
    return { ok: false, limit, used: limit, plan };
  }

  syncInMemoryUsage(user, updated.usage);
  return { ok: true, limit, used: updated.usage.aiCallsToday, plan };
};

/** AI chaqiruvi muvaffaqiyatsiz tugadi — limitni qaytarish */
const refundAiCall = async (user) => {
  const today = userDayKey(user);
  const updated = await User.findOneAndUpdate(
    {
      _id: user._id,
      'usage.aiCallsDate': today,
      'usage.aiCallsToday': { $gt: 0 },
    },
    { $inc: { 'usage.aiCallsToday': -1 } },
    { new: true, projection: { usage: 1 } }
  ).lean();
  if (updated) syncInMemoryUsage(user, updated.usage);
};

const quotaExceededResponse = (res, { limit, plan }) =>
  res.status(402).json({
    message: "Kunlik AI limiti tugadi. Pro tarifga o'ting.",
    code: 'AI_QUOTA_EXCEEDED',
    plan,
    limit,
  });

/**
 * Middleware: kvotani band qiladi va `req.aiCall.refund()` ni ochib beradi.
 * Route AI xatosini ushlasa — refund() chaqirsin.
 */
const trackAiUsage = async (req, res, next) => {
  try {
    const result = await reserveAiCall(req.user);
    if (!result.ok) {
      return quotaExceededResponse(res, result);
    }

    let settled = false;
    req.aiCall = {
      limit: result.limit,
      used: result.used,
      /** AI javob bermadi — bandlikni bekor qilish */
      refund: async () => {
        if (settled) return;
        settled = true;
        await refundAiCall(req.user).catch((err) =>
          console.error('AI kvotani qaytarishda xato:', err.message)
        );
      },
      /** AI muvaffaqiyatli javob berdi — bandlik o'z kuchida qoladi */
      commit: () => {
        settled = true;
      },
    };

    next();
  } catch (error) {
    console.error('Usage quota error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Eski nom — faqat tekshiradi, band qilmaydi (speaking/translate kabi shartli oqimlar uchun) */
const checkAiQuota = async (req, res, next) => {
  try {
    const limit = getAiLimit(req.user);
    const today = userDayKey(req.user);
    const used = req.user.usage?.aiCallsDate === today ? req.user.usage.aiCallsToday : 0;
    if (used >= limit) {
      return quotaExceededResponse(res, { limit, plan: req.user.getEffectivePlan() });
    }
    next();
  } catch (error) {
    console.error('Usage quota check error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/** AI haqiqatan chaqirilgandan keyin hisobga yozish (shartli oqimlar uchun) */
const recordAiUsage = async (user) => {
  await reserveAiCall(user);
};

module.exports = {
  trackAiUsage,
  checkAiQuota,
  recordAiUsage,
  reserveAiCall,
  refundAiCall,
  getAiLimit,
  PLAN_LIMITS,
};
