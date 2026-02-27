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
  onboarding: {
    completed: { type: Boolean, default: false },
    level: { type: String, default: 'beginner' }, // beginner, intermediate, advanced
    goal: { type: String, default: 'speaking' }, // speaking, vocabulary, grammar
    planType: { type: String, default: 'standard' } // sprint, foundation, fluency
  },
  dailyQuests: {
    date: { type: String, default: '' }, // YYYY-MM-DD
    reviewCompleted: { type: Boolean, default: false },
    topicCompleted: { type: Boolean, default: false },
    immersionCompleted: { type: Boolean, default: false },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
userSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
