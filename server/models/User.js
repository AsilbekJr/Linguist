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
  /** Google orqali ochilgan hisobda parol bo'lmasligi mumkin */
  password: {
    type: String,
    required: function () {
      return !this.googleId;
    },
  },
  /**
   * Parol o'rnatilganmi. Alohida maydon, chunki `protect` foydalanuvchini
   * parolsiz (`-password`) yuklaydi — profilda buni hash'dan bilib bo'lmaydi.
   */
  hasPassword: { type: Boolean, default: true },
  /** Google hisobi (`sub`) — email o'zgarsa ham shu bo'yicha topiladi */
  googleId: { type: String, index: { unique: true, sparse: true } },
  /**
   * Email egasi tasdiqladimi (xatdagi havola yoki parolni tiklash orqali).
   * Tasdiqlanmagan hisob ilovadan to'liq foydalanadi — faqat to'lov va
   * email eslatmalar yopiq: begona manzilga xat yuborish pochta obro'sini
   * buzadi, to'lov esa hisobni tiklab bo'ladigan manzilga bog'lanishi kerak.
   */
  emailVerified: { type: Boolean, default: false },
  emailVerifiedAt: { type: Date, default: null },
  /** Qayta yuborishni cheklash uchun (spam bo'lmasin) */
  emailVerificationSentAt: { type: Date, default: null },
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
  /**
   * Telegram — eslatmaning asosiy kanali (O'zbekistonda email deyarli
   * o'qilmaydi, push esa iOS'da faqat o'rnatilgan PWA'da ishlaydi).
   * Bog'lash bir martalik kod orqali: kod faqat hash ko'rinishida saqlanadi.
   */
  telegram: {
    chatId: { type: String, index: true, sparse: true },
    username: { type: String, default: '' },
    linkedAt: { type: Date, default: null },
    linkCodeHash: { type: String, index: true, sparse: true },
    linkCodeExpires: { type: Date, default: null },
  },
  /**
   * Faollik tarixi ('YYYY-MM-DD', foydalanuvchi zonasida) — "Bugun" sahifasidagi
   * hafta tasmasi uchun. Ilgari faqat streak SONI saqlanardi va qaysi kun
   * bajarilganini, qaysi biri muzlatilganini bilib bo'lmasdi. Oxirgi 60 kun.
   */
  activity: {
    planDays: { type: [String], default: [] },
    frozenDays: { type: [String], default: [] },
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
    /**
     * Takrorlash qadami yopildi, lekin takrorlanadigan so'z bo'lmagan
     * (masalan yangi foydalanuvchi). Streak uchun qadam bajarilgan hisoblanadi,
     * lekin XP berilmaydi va UI "Bajarildi" emas, "so'z yo'q" deb ko'rsatadi.
     */
    reviewSkipped: { type: Boolean, default: false },
    topicCompleted: { type: Boolean, default: false },
    /** Suhbat — bugungi sahna qahramoni bilan gapirish. Rejaning majburiy qadami */
    speakCompleted: { type: Boolean, default: false },
    /**
     * Tinglash mashqi. Kunlik rejaning 3 qadamiga KIRMAYDI va streak'ni
     * bloklamaydi — bu ixtiyoriy qo'shimcha. Aks holda kunlik yuk oshib,
     * reja bajarilishi tushib ketardi.
     */
    listeningCompleted: { type: Boolean, default: false },
    /** Bugun navbatdan takrorlangan so'zlar soni (mashq rejimi hisobga olinmaydi) */
    reviewedCount: { type: Number, default: 0 },
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

/**
 * bcrypt ish narxi. 12 — hozirgi tavsiya (~250 ms). Eski hisoblardagi
 * 10-li hash'lar muvaffaqiyatli login paytida jimgina yangilanadi.
 */
const BCRYPT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  if (!this.password) {
    this.hasPassword = false;
    return;
  }
  this.hasPassword = true;
  const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  // Parolsiz (Google) hisob: vaqt farqi bo'lmasin — soxta tekshiruv
  if (!this.password) return this.constructor.fakePasswordCheck(enteredPassword);
  return await bcrypt.compare(enteredPassword, this.password);
};

/** Hash eski (kuchsizroq) parametrlar bilan yaratilganmi */
userSchema.methods.needsRehash = function () {
  try {
    return bcrypt.getRounds(this.password) < BCRYPT_ROUNDS;
  } catch {
    return false;
  }
};

/**
 * Foydalanuvchi topilmaganda ham bcrypt bajariladi — aks holda javob
 * tezligidan "bu email ro'yxatdan o'tganmi" ni bilib olish mumkin.
 */
const DUMMY_HASH = bcrypt.hashSync('linguist-timing-equalizer', BCRYPT_ROUNDS);
userSchema.statics.fakePasswordCheck = async function (enteredPassword) {
  await bcrypt.compare(String(enteredPassword || ''), DUMMY_HASH);
  return false;
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
