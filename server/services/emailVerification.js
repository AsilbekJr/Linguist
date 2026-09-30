const User = require('../models/User');
const EmailVerificationToken = require('../models/EmailVerificationToken');
const { generateResetToken, hashToken, VERIFY_TOKEN_TTL_MS } = require('../utils/tokens');
const { sendMail, verifyEmailEmail } = require('./mailer');

/** Qayta yuborish oralig'i — tugmani ketma-ket bosish pochta qutisini to'ldirmasin */
const RESEND_COOLDOWN_MS = 60 * 1000;

/**
 * Tasdiqlash xatini yuboradi. Eski havolalar bekor qilinadi — bir vaqtda
 * faqat oxirgisi ishlaydi (parolni tiklash bilan bir xil).
 *
 * @returns {Promise<{sent: boolean, reason?: string, retryAfterSec?: number}>}
 */
const sendVerificationEmail = async (user, { force = false } = {}) => {
  if (user.emailVerified) return { sent: false, reason: 'ALREADY_VERIFIED' };

  // Yuborish huquqi atomik "band qilinadi": tugma ikki marta bosilsa yoki
  // ro'yxatdan o'tishdagi fon yuborish bilan ustma-ust tushsa, faqat bittasi
  // o'tadi. Avval tekshirib, keyin yozish bu oraliqda ikkita xat yuborardi.
  const now = Date.now();
  const claimed = await User.findOneAndUpdate(
    {
      _id: user._id,
      emailVerified: { $ne: true },
      ...(force
        ? {}
        : {
            $or: [
              { emailVerificationSentAt: null },
              { emailVerificationSentAt: { $lte: new Date(now - RESEND_COOLDOWN_MS) } },
            ],
          }),
    },
    { emailVerificationSentAt: new Date(now) },
    { returnDocument: 'after' }
  );
  if (!claimed) {
    const fresh = await User.findById(user._id).select('emailVerified emailVerificationSentAt').lean();
    if (fresh?.emailVerified) return { sent: false, reason: 'ALREADY_VERIFIED' };
    const last = fresh?.emailVerificationSentAt ? new Date(fresh.emailVerificationSentAt).getTime() : now;
    const wait = Math.max(1000, last + RESEND_COOLDOWN_MS - now);
    return { sent: false, reason: 'COOLDOWN', retryAfterSec: Math.ceil(wait / 1000) };
  }
  user.emailVerificationSentAt = claimed.emailVerificationSentAt;

  await EmailVerificationToken.updateMany({ user: user._id, usedAt: null }, { usedAt: new Date() });

  const rawToken = generateResetToken();
  await EmailVerificationToken.create({
    user: user._id,
    tokenHash: hashToken(rawToken),
    email: user.email,
    expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
  });

  const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
  const { delivered, reason } = await sendMail({
    to: user.email,
    ...verifyEmailEmail(user.name, `${clientUrl}/verify-email?token=${rawToken}`),
  });
  // Lokal ishlab chiqishda pochta sozlanmagan — xat konsolga chiqdi, bu yetarli
  const loggedLocally = reason === 'NOT_CONFIGURED' && process.env.NODE_ENV !== 'production';
  return delivered || loggedLocally ? { sent: true } : { sent: false, reason: 'MAIL_FAILED' };
};

/**
 * Havoladagi tokenni tekshiradi.
 *
 * Allaqachon ishlatilgan token egasi tasdiqlangan bo'lsa — xato emas:
 * odam havolani ikki marta bosishi yoki pochta skaneri uni oldindan
 * ochishi mumkin. Bunday holatda "allaqachon tasdiqlangan" deymiz.
 *
 * @returns {Promise<{user?: object, alreadyVerified?: boolean, error?: string}>}
 */
const verifyEmailToken = async (rawToken) => {
  const record = await EmailVerificationToken.findOne({ tokenHash: hashToken(rawToken) });
  if (!record || record.expiresAt <= new Date()) return { error: 'INVALID_VERIFY_TOKEN' };

  const user = await User.findById(record.user);
  if (!user) return { error: 'INVALID_VERIFY_TOKEN' };

  if (record.usedAt) {
    if (user.emailVerified && user.email === record.email) return { user, alreadyVerified: true };
    return { error: 'INVALID_VERIFY_TOKEN' };
  }

  // Havola yuborilgandan keyin email o'zgargan bo'lsa — eski manzil egasi
  // yangi manzilni tasdiqlay olmasin
  if (user.email !== record.email) return { error: 'INVALID_VERIFY_TOKEN' };

  record.usedAt = new Date();
  await record.save();
  if (!user.emailVerified) {
    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();
  }
  return { user };
};

/** Parolni tiklash ham pochta qutisi egaligini isbotlaydi */
const markEmailVerified = async (user) => {
  if (user.emailVerified) return;
  user.emailVerified = true;
  user.emailVerifiedAt = new Date();
  await EmailVerificationToken.updateMany({ user: user._id, usedAt: null }, { usedAt: new Date() });
};

module.exports = { sendVerificationEmail, verifyEmailToken, markEmailVerified, RESEND_COOLDOWN_MS };
