const mongoose = require('mongoose');

/**
 * Suhbat — bugungi sahna qahramoni bilan ovozli rolli o'yin.
 *
 * Kunlik rejaning majburiy qadami (Sahna → Suhbat → Takrorlash). Holat
 * serverda turadi: topshiriqlar va ishlatilgan so'zlarni mijoz emas, server
 * belgilaydi — aks holda qadamni bitta so'rov bilan "bajarib" qo'yish
 * mumkin bo'lardi (eski `sync-quest` teshigi kabi).
 *
 * `mode`:
 *  - `ai`       — qahramon Gemini orqali erkin javob beradi;
 *  - `scripted` — qahramon sahna dialogidagi qatorlarni aytadi. AI sozlanmagan,
 *                 limit tugagan yoki suhbat o'rtasida AI uzilganda ishlaydi —
 *                 majburiy qadam hech qachon tashqi xizmat tufayli bloklanmasin.
 */
const turnSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['partner', 'user'], required: true },
    text: { type: String, required: true },
    /** Qahramon replikasining tarjimasi ("Tushunmadim" bosilganda ko'rsatiladi) */
    textUz: { type: String, default: '' },
    via: { type: String, enum: ['voice', 'text', null], default: null },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  /** Foydalanuvchi zonasidagi kun ('YYYY-MM-DD') — kunlik limit shu bo'yicha */
  dayKey: { type: String, required: true },
  contentDay: { type: Number, required: true },
  mode: { type: String, enum: ['ai', 'scripted'], default: 'ai' },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },

  partner: {
    name: { type: String, default: '' },
    emoji: { type: String, default: '' },
  },
  topicUz: { type: String, default: '' },
  situationUz: { type: String, default: '' },
  cefr: { type: String, default: '' },
  /** Onboarding maqsadi (speaking | vocabulary | general) — qahramon uslubini belgilaydi */
  learnerGoal: { type: String, default: 'general' },

  /** Bugungi so'zlar — foydalanuvchi ularni gapida ishlatishi kerak */
  targetWords: [
    {
      _id: false,
      word: String,
      translation: String,
      used: { type: Boolean, default: false },
    },
  ],
  /** Muloqot maqsadlari (AI rejimida; ssenariy rejimida bo'sh) */
  goals: [
    {
      _id: false,
      id: String,
      textUz: String,
      done: { type: Boolean, default: false },
    },
  ],
  turns: [turnSchema],
  /** Ssenariy rejimida dialogning qaysi qatoriga yetilgan */
  scriptIndex: { type: Number, default: 0 },
  /** Mikrofon orqali gapirilgan taxminiy vaqt (mijoz o'lchaydi, cheklangan) */
  spokenSeconds: { type: Number, default: 0 },

  feedback: {
    summaryUz: { type: String, default: '' },
    corrections: [
      {
        _id: false,
        said: String,
        better: String,
        explanationUz: String,
      },
    ],
  },
  completedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

conversationSchema.index({ user: 1, dayKey: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
