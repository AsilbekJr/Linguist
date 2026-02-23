const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema({
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
  audioData: {
    type: String, // Base64 encoded webm/mp3
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'completed'],
    default: 'pending'
  }
}, { timestamps: true });

// A user should only have exactly one record per dayNumber.
// If multi-user auth is added later, this should be a compound index with userId.
challengeSchema.index({ dayNumber: 1 }, { unique: true });

module.exports = mongoose.model('Challenge', challengeSchema);
