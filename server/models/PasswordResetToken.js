const mongoose = require('mongoose');

/**
 * Parolni tiklash tokeni.
 *
 * Tokenning O'ZI saqlanmaydi — faqat SHA-256 hash'i. Bazaga kirish huquqi
 * bo'lgan kishi ham hech kimning parolini tiklay olmaydi (refresh token
 * sessiyalari bilan bir xil yondashuv).
 *
 * TTL indeks muddati o'tgan yozuvlarni o'zi tozalaydi.
 */
const passwordResetTokenSchema = new mongoose.Schema({
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
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
  /** Bir marta ishlatiladi — qayta ishlatishga urinish rad etiladi */
  usedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
