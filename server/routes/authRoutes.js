const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { protect } = require('../middleware/authMiddleware');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: '30d',
  });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please add all fields' });
    }

    // Check if user exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      res.status(201).json({
        _id: user.id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: 'Server error', error: error.message, stack: error.stack });
  }
});

// @desc    Authenticate a user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user email
    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user.id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Get user data
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.error("Auth me error:", error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Save user onboarding data
// @route   POST /api/auth/onboard
// @access  Private
router.post('/onboard', protect, async (req, res) => {
  try {
    const { level, goal, planType } = req.body;
    
    req.user.onboarding = {
      completed: true,
      level: level || 'beginner',
      goal: goal || 'speaking',
      planType: planType || 'standard'
    };

    const updatedUser = await req.user.save();
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Onboarding error:", error);
    res.status(500).json({ message: 'Server error during onboarding' });
  }
});

// @desc    Sync daily quests
// @route   POST /api/auth/sync-quest
// @access  Private
router.post('/sync-quest', protect, async (req, res) => {
  try {
    const { type } = req.body; // 'review', 'topic', 'immersion'
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    let isStreakUpdated = false;

    // Reset daily quests if date changed
    if (req.user.dailyQuests.date !== today) {
      req.user.dailyQuests = {
        date: today,
        reviewCompleted: false,
        topicCompleted: false,
        immersionCompleted: false
      };
      
      // Check if streak was broken (last active date was NOT yesterday)
      if (req.user.lastActiveDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        const lastActiveStr = req.user.lastActiveDate.toISOString().split('T')[0];
        if (lastActiveStr !== yesterdayStr && lastActiveStr !== today) {
           req.user.currentStreak = 0; // Streak broken
        }
      }
    }

    // Update quest type
    if (type === 'review') req.user.dailyQuests.reviewCompleted = true;
    if (type === 'topic') req.user.dailyQuests.topicCompleted = true;
    if (type === 'immersion') req.user.dailyQuests.immersionCompleted = true;

    // Check if all quests are completed for today
    const { reviewCompleted, topicCompleted, immersionCompleted } = req.user.dailyQuests;
    const allCompletedNow = reviewCompleted && topicCompleted && immersionCompleted;
    
    // Only increment streak and xp if they just finished all 3 TODAY, 
    // and haven't already updated lastActiveDate for today.
    const lastActiveStr = req.user.lastActiveDate ? req.user.lastActiveDate.toISOString().split('T')[0] : null;
    
    if (allCompletedNow && lastActiveStr !== today) {
       req.user.currentStreak += 1;
       req.user.xp += 50; // Award 50 XP
       req.user.lastActiveDate = new Date();
       
       if (req.user.currentStreak > req.user.longestStreak) {
           req.user.longestStreak = req.user.currentStreak;
       }
       isStreakUpdated = true;
    }

    const updatedUser = await req.user.save();
    
    res.status(200).json({ 
       user: updatedUser, 
       streakUpdated: isStreakUpdated,
       message: isStreakUpdated ? "All daily quests completed! +50 XP" : "Quest synced." 
    });

  } catch (error) {
    console.error("Sync quest error:", error);
    res.status(500).json({ message: 'Server error during quest sync' });
  }
});

module.exports = router;
