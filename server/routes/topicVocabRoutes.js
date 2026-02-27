const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const TopicProgress = require('../models/TopicProgress');
const { protect } = require('../middleware/authMiddleware');

// Load JSON data at startup
const topicsDataPath = path.join(__dirname, '../data/topics.json');
let topicsData = [];

try {
  const data = fs.readFileSync(topicsDataPath, 'utf8');
  topicsData = JSON.parse(data);
} catch (error) {
  console.error('Error reading topics.json:', error);
}

// @desc    Get current day topic and words
// @route   GET /api/topics/current
// @access  Private
router.get('/current', protect, async (req, res) => {
  try {
    let progress = await TopicProgress.findOne({ user: req.user._id });
    
    // Create progress profile if it doesn't exist
    if (!progress) {
      progress = new TopicProgress({
        user: req.user._id,
        currentDay: 1,
        history: []
      });
      await progress.save();
    }

    const { currentDay, history } = progress;
    
    // Check if maximum day reached
    if (currentDay > topicsData.length) {
       return res.json({ 
          message: "You have completed all topics!",
          isFinished: true,
          history
       });
    }
    
    // Find the topic for the current day
    const currentTopic = topicsData.find(t => t.day === currentDay);
    
    if (!currentTopic) {
        return res.status(404).json({ error: "Topic not found for the current day." });
    }

    // Check if today was already completed
    const todayStr = new Date().toISOString().split('T')[0];
    const latestComplete = history.length > 0 ? history[history.length - 1] : null;
    let isCompleteForToday = false;
    
    if (latestComplete) {
       const latestDateStr = new Date(latestComplete.completedAt).toISOString().split('T')[0];
       
       // Note: Because we increment the currentDay ON completion, if the last completion
       // was today, then they cannot proceed to the *next* day until tomorrow.
       if (latestDateStr === todayStr) {
           isCompleteForToday = true;
       }
    }

    if (isCompleteForToday) {
       const completedTopic = topicsData.find(t => t.day === progress.currentDay - 1);
       return res.json({
           ...(completedTopic || currentTopic),
           isCompleteForToday: true,
           history
       });
    }

    // Return the current topic to be displayed
    res.json({
       ...currentTopic,
       history
    });

  } catch (error) {
    console.error('Topic API Error:', error);
    res.status(500).json({ error: 'Server Error' });
  }
});

// @desc    Complete current day
// @route   POST /api/topics/complete
// @access  Private
router.post('/complete', protect, async (req, res) => {
    try {
        const progress = await TopicProgress.findOne({ user: req.user._id });
        
        if (!progress) {
            return res.status(404).json({ error: 'Progress not found' });
        }

        // Add to history
        progress.history.push({ day: progress.currentDay, completedAt: new Date() });
        
        // Increment day counter
        progress.currentDay += 1;
        
        await progress.save();
        
        res.json({ message: 'Topic marked as complete!', currentDay: progress.currentDay });
    } catch (error) {
        console.error('Topic API Error (Complete):', error);
        res.status(500).json({ error: 'Server Error' });
    }
});

module.exports = router;
