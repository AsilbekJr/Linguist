const mongoose = require('mongoose');

/**
 * Emailni tasdiqlash tokeni.
 *
 * PasswordResetToken bilan bir xil yondashuv: tokenning o'zi emas, faqat
 * SHA-256 hash'i saqlanadi; bir martalik; TTL indeks muddati o'tganlarni
 * o'zi tozalaydi.
 */
const emailVerificationTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  tokenHash: {
    type: String,
    required: true,
    index: true,
  },
  /** Qaysi manzil uchun yuborilgan — email keyinchalik o'zgarsa eski havola ishlamasin */
  email: {
    type: String,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
  usedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('EmailVerificationToken', emailVerificationTokenSchema);
