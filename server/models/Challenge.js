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
challengeSchema.index({ user: 1, dayNumber: 1 }, { unique: true });

module.exports = mongoose.model('Challenge', challengeSchema);
