const mongoose = require('mongoose');

/**
 * Refresh sessiyasi.
 *
 * Refresh token har `/refresh` da almashtiriladi (rotation): eski yozuv
 * `revokedReason: 'rotated'` bilan yopiladi va `replacedBy` yangisiga
 * ishora qiladi. Bitta login'dan kelib chiqqan barcha yozuvlar bitta
 * `familyId` ga ega. Allaqachon almashtirilgan token qayta kelsa — u
 * o'g'irlangan deb hisoblanadi va butun oila yopiladi.
 *
 * Tokenning O'ZI saqlanmaydi — faqat SHA-256 hash'i.
 */
const REVOKE_REASONS = ['rotated', 'logout', 'password_change', 'reuse_detected', 'revoked', 'account_deleted'];

const sessionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  refreshTokenHash: {
    type: String,
    required: true,
    index: true,
  },
  /** Bitta login'dan kelib chiqqan zanjir. Eski yozuvlarda yo'q — o'rniga `_id` ishlatiladi */
  familyId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true,
  },
  replacedBy: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 },
  },
  revokedAt: {
    type: Date,
    default: null,
  },
  revokedReason: {
    type: String,
    enum: [...REVOKE_REASONS, null],
    default: null,
  },
  /** Qurilmalar ro'yxati uchun (B bosqich) — qisqartirilgan holda saqlanadi */
  userAgent: { type: String, default: '' },
  ip: { type: String, default: '' },
  lastUsedAt: { type: Date, default: Date.now },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

sessionSchema.pre('validate', function () {
  if (!this.familyId) this.familyId = this._id;
});

sessionSchema.statics.REVOKE_REASONS = REVOKE_REASONS;

module.exports = mongoose.model('Session', sessionSchema);
