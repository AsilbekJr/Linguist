const mongoose = require('mongoose');

const topicProgressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  currentDay: {
    type: Number,
    default: 1,
  },
  history: [
    {
      day: Number,
      completedAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
}, { timestamps: true });

module.exports = mongoose.model('TopicProgress', topicProgressSchema);
