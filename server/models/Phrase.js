const mongoose = require('mongoose');

/**
 * Ibora kartasi — sahnada "Yod olish" qadamida yodlangan kalit gap.
 *
 * So'z kartasidan alohida, chunki takrorlash usuli boshqa: so'zda bosqichga
 * qarab tanib olish → eslash → gap tuzish, iborada esa doim bitta topshiriq —
 * o'zbekcha ma'nodan butun gapni ovoz bilan aytish. Word modeliga qo'shilsa,
 * lug'at ro'yxati, so'z statistikasi va rejim tanlash buzilardi.
 */
const phraseSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  /** Takrorlanmasligi uchun: kichik harf, ortiqcha bo'shliqsiz */
  key: { type: String, required: true },
  text: { type: String, required: true },
  textUz: { type: String, default: '' },
  wordIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Word' }],
  wordLabels: [String],
  contentDay: { type: Number, default: null },
  stage: { type: Number, default: 0 },
  lapses: { type: Number, default: 0 },
  nextReviewDate: { type: Date, required: true },
  learned: { type: Boolean, default: false },
  lastReviewedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

phraseSchema.index({ user: 1, key: 1 }, { unique: true });
phraseSchema.index({ user: 1, learned: 1, nextReviewDate: 1 });

module.exports = mongoose.model('Phrase', phraseSchema);
