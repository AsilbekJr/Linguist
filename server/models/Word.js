const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    word: {
        type: String,
        required: true
    },
    phonetic: String,
    definition: String,
    translation: String,
    examples: [String],
    collocations: [String],
    imageUrl: String,
    mastered: {
        type: Boolean,
        default: false
    },
    reviewStage: {
        type: Number,
        default: 0
    },
    nextReviewDate: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Add indexes for performance
wordSchema.index({ user: 1, createdAt: -1 });
wordSchema.index({ user: 1, nextReviewDate: 1, reviewStage: 1 });

module.exports = mongoose.model('Word', wordSchema);
