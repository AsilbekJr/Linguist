const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  xp: {
    type: Number,
    default: 0,
  },
  currentStreak: {
    type: Number,
    default: 0,
  },
  longestStreak: {
    type: Number,
    default: 0,
  },
  lastActiveDate: {
    type: Date,
    default: null,
  },
  /** Oxirgi streak hisoblangan kun ('YYYY-MM-DD', foydalanuvchi zonasida) */
  lastStreakDay: {
    type: String,
    default: '',
  },
  /** IANA zona nomi — kunlik reja, streak va kvota shunga qarab hisoblanadi */
  timezone: {
    type: String,
    default: 'Asia/Tashkent',
  },
  /**
   * Eslatmalar.
   * `hour` — foydalanuvchi MAHALLIY vaqtidagi soat (0-23). Server UTC'da
   * ishlasa ham eslatma odamning kechqurunida yetib boradi.
   */
  notifications: {
    email: {
      enabled: { type: Boolean, default: true },
      hour: { type: Number, default: 19, min: 0, max: 23 },
      lastSentDay: { type: String, default: '' },
      sentCount: { type: Number, default: 0 },
    },
    /** Xatdagi obunani bekor qilish havolasi uchun — login talab qilmaydi */
    unsubscribeToken: { type: String, index: true, sparse: true },
  },
  /** Streak muzlatish: kun o'tkazib yuborilsa streak saqlanadi */
  streakFreeze: {
    available: { type: Number, default: 2 },
    lastGrantedMonth: { type: String, default: '' },
    lastUsedDay: { type: String, default: '' },
  },
  onboarding: {
    completed: { type: Boolean, default: false },
    level: { type: String, default: 'beginner' },
    goal: { type: String, default: 'speaking' },
    planType: { type: String, default: 'standard' },
    /**
     * Placement testi natijasi (A1/A2/B1/B2).
     * `level` dan farqi: bu O'LCHANGAN daraja, `level` esa ilova ichidagi
     * uch bosqichli soddalashtirish. Foydalanuvchi o'zi tanlagan bo'lsa bu bo'sh.
     */
    placedCefr: { type: String, default: null },
  },
  dailyQuests: {
    date: { type: String, default: '' },
    reviewCompleted: { type: Boolean, default: false },
    topicCompleted: { type: Boolean, default: false },
    immersionCompleted: { type: Boolean, default: false },
    /**
     * Tinglash mashqi. Kunlik rejaning 3 qadamiga KIRMAYDI va streak'ni
     * bloklamaydi — bu ixtiyoriy qo'shimcha. Aks holda kunlik yuk oshib,
     * reja bajarilishi tushib ketardi.
     */
    listeningCompleted: { type: Boolean, default: false },
  },
  subscription: {
    plan: { type: String, enum: ['free', 'pro', 'premium'], default: 'free' },
    status: {
      type: String,
      enum: ['active', 'canceled', 'past_due', 'trialing'],
      default: 'active',
    },
    provider: { type: String, enum: ['stripe', 'payme', 'click', null], default: null },
    stripeCustomerId: String,
    stripeSubscriptionId: String,
    paymeSubscriptionId: String,
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  usage: {
    aiCallsToday: { type: Number, default: 0 },
    aiCallsDate: { type: String, default: '' },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.methods.getEffectivePlan = function () {
  const sub = this.subscription || {};
  const plan = sub.plan || 'free';
  const status = sub.status || 'active';
  if (plan === 'free' || status !== 'active') return 'free';
  if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) < new Date()) return 'free';
  return plan;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
