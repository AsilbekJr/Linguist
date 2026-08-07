const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  dayNumber: {
    type: Number,
    required: true,
  },
  topic: {
    type: String,
    required: true,
  },
  text: {
    type: String,
    required: true,
  },
  /**
   * Base64 audio. VAQTINCHALIK — Mongo hujjat limiti 16MB va foydalanuvchi
   * boshiga 100 kun × bir necha MB juda tez to'planadi. Keyingi bosqichda
   * obyekt saqlovga (R2/S3) ko'chiriladi va bu yerda faqat `audioUrl` qoladi.
   * Hozircha Zod darajasida 3.5MB cheklov qo'yilgan (validate.js).
   */
  audioData: {
    type: String,
    default: null
  },
  audioUrl: {
    type: String,
    default: null
  },
  /** Baho qanday olingani — 'transcript_match' | 'none'. UI buni halol ko'rsatishi kerak. */
  evaluationMethod: {
    type: String,
    default: null
  },
  score: {
    type: Number,
    default: null
  },
  feedback: {
    type: String,
    default: null
  },
  color: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  }
}, { timestamps: true });

// A user should only have exactly one record per dayNumber.
challengeSchema.index({ user: 1, dayNumber: 1 }, { unique: true });

module.exports = mongoose.model('Challenge', challengeSchema);
