const mongoose = require('mongoose');

/**
 * Mini-test sessiyasi.
 *
 * Ilgari test butunlay mijozda ishlardi: savollar ham, to'g'ri javob ham brauzerda
 * edi, natija `sessionStorage`ga yozilardi va server `req.body.quizPassed` ga
 * ishonardi. Ya'ni DevTools'da bitta qator bilan butun kunni o'tkazib yuborish
 * mumkin edi — bu testni butunlay ma'nosiz qilardi.
 *
 * Endi savollar serverda yaratiladi, to'g'ri javob indeksi mijozga YUBORILMAYDI,
 * va natija shu yerda saqlanadi.
 */
const quizSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** Qaysi kontent kuni uchun */
    contentDay: { type: Number, required: true },
    /** Foydalanuvchi zonasidagi kun kaliti */
    dayKey: { type: String, required: true },
    questions: [
      {
        word: String,
        options: [String],
        /** To'g'ri variant indeksi — hech qachon mijozga chiqmaydi */
        correctIndex: Number,
      },
    ],
    passed: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    attempts: { type: Number, default: 0 },
    /** 2 soatdan keyin avtomatik o'chadi — bu vaqtinchalik holat */
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 2 * 60 * 60 * 1000),
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

quizSessionSchema.index({ user: 1, dayKey: 1, contentDay: 1 });

module.exports = mongoose.model('QuizSession', quizSessionSchema);
