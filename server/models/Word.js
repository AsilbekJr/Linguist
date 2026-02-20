const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    word: {
        type: String,
        required: true
    },
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

module.exports = mongoose.model('Word', wordSchema);
