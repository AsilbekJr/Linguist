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
    definition: String,
    translation: String,
    examples: [String],
    collocations: [String],
    imageUrl: String,
    mastered: {
        type: Boolean,
        default: false
    },
    nextReviewDate: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Word', wordSchema);
