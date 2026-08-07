const mongoose = require('mongoose');

/**
 * Web Push obunasi.
 *
 * Bitta foydalanuvchida bir nechta obuna bo'lishi mumkin — telefon, planshet,
 * noutbuk. Har birига alohida yozuv, chunki har bir brauzer o'zining
 * `endpoint`ini beradi.
 *
 * `endpoint` unikal: bir xil brauzer qayta obuna bo'lsa yozuv yangilanadi,
 * dublikat yaratilmaydi.
 */
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
      unique: true,
    },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    /** Qaysi qurilma ekanini foydalanuvchiga ko'rsatish uchun */
    userAgent: { type: String, default: '' },
    /**
     * Ketma-ket muvaffaqiyatsizliklar. Push xizmati 404/410 qaytarsa obuna
     * darhol o'chiriladi; boshqa xatolarda esa bir necha urinishdan keyin.
     */
    failureCount: { type: Number, default: 0 },
    lastSentAt: Date,
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PushSubscription', pushSubscriptionSchema);
