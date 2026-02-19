const mongoose = require('mongoose');

const storySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Relaxed for dev/mock mode
    },
    title: String,
    content: {
        type: String,
        required: true
    },
    wordsUsed: [String], // Simplified to array of strings for now
    vibeScore: Number,
    analysis: Object, // Store full JSON analysis
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Story', storySchema);
