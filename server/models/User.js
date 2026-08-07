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
  },
  dailyQuests: {
    date: { type: String, default: '' },
    reviewCompleted: { type: Boolean, default: false },
    topicCompleted: { type: Boolean, default: false },
    immersionCompleted: { type: Boolean, default: false },
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
