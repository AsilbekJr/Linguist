const mongoose = require('mongoose');

/**
 * Daraja aniqlash testi sessiyasi.
 *
 * Mini-test bilan bir xil tamoyil: savollar va to'g'ri javoblar SERVERDA,
 * mijozga faqat savol matni va variantlar yuboriladi. Aks holda foydalanuvchi
 * o'ziga yuqori daraja "qo'yib" olardi va butun kurs noto'g'ri kontentdan
 * boshlanardi — bu esa testning butun ma'nosini yo'qotadi.
 */
const placementSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    /** Berilgan savollar va javoblar tarixi */
    answers: [
      {
        itemId: String,
        cefr: String,
        answered: Number,
        correct: Boolean,
      },
    ],
    /** Hozir kutilayotgan savol — mijoz boshqa savolga javob yubora olmasin */
    pendingItemId: { type: String, default: null },
    completed: { type: Boolean, default: false },
    resultCefr: { type: String, default: null },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 60 * 60 * 1000),
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlacementSession', placementSessionSchema);
