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
    
    // 1. Check if maximum day reached
    if (currentDay > topicsData.length) {
       return res.json({ 
          message: "You have completed all topics!",
          isFinished: true,
          history
       });
    }

    // 2. Determine if today is completed
    const todayStr = new Date().toISOString().split('T')[0];
    const latestComplete = history.length > 0 ? history[history.length - 1] : null;
    let isCompleteForToday = false;
    
    if (latestComplete) {
       const latestDateStr = new Date(latestComplete.completedAt).toISOString().split('T')[0];
       if (latestDateStr === todayStr) {
           isCompleteForToday = true;
       }
    }

    // 3. User target day for fetching words
    // If complete today, we are still displaying the (currentDay-1) effectively.
    // However, the progress.currentDay was already incremented during /complete.
    // So if isCompleteForToday is true, targetDay = currentDay - 1
    // If NOT complete, targetDay = currentDay
    const targetDay = isCompleteForToday ? Math.max(1, currentDay - 1) : currentDay;
    
    // 4. Fetch the title and desc from the "active" topic
    const baseTopic = topicsData.find(t => t.day === targetDay);
    if (!baseTopic) {
        return res.status(404).json({ error: "Topic not found for the current day." });
    }

    // 5. Gather all words from Day 1 to targetDay
    let allCumulativeWords = [];
    for (let i = 1; i <= targetDay; i++) {
        const topicOfDay = topicsData.find(t => t.day === i);
        if (topicOfDay && topicOfDay.words) {
            allCumulativeWords = allCumulativeWords.concat(topicOfDay.words);
        }
    }

    // 6. Find words user has already mastered (saved to dictionary)
    const Word = require('../models/Word'); // Ensure Word model is required
    const userSavedWordsObj = await Word.find({ user: req.user._id }).select('word -_id');
    const userSavedWords = userSavedWordsObj.map(w => w.word.toLowerCase());

    // 7. Filter: Only keep words NOT saved by user
    const unmasteredWords = allCumulativeWords.filter(topicWord => 
        !userSavedWords.includes(topicWord.word.toLowerCase())
    );

    // Return the combined, filtered topic
    res.json({
       ...baseTopic, // keep title/desc of the current active topic
       words: unmasteredWords, // Override words with all unmastered
       isCompleteForToday: isCompleteForToday,
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
