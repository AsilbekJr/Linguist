const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const { validate, authRegisterSchema, authLoginSchema, onboardSchema, syncQuestSchema } = require('../middleware/validate');
const { generateAccessToken } = require('../utils/tokens');
const { createSession, revokeSessionByCookie, findValidSession } = require('../services/authSessionService');
const Word = require('../models/Word');
const {
  enrichUserProfile,
  QUEST_STEP_XP,
  DAILY_BONUS_XP,
} = require('../utils/gamification');

const formatUser = async (user) => {
  const totalWords = await Word.countDocuments({ user: user._id });
  return enrichUserProfile(user, { totalWords });
};

const sendAuthResponse = async (user, res, status = 200) => {
  const token = generateAccessToken(user._id);
  await createSession(user._id, res);
  const profile = await formatUser(user);
  res.status(status).json({
    _id: user.id,
    name: user.name,
    email: user.email,
    token,
    ...profile,
  });
};

router.post('/register', validate(authRegisterSchema), async (req, res) => {
  try {
    const { name, email, password } = req.validated.body;
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const user = await User.create({ name, email, password });
    await sendAuthResponse(user, res, 201);
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', validate(authLoginSchema), async (req, res) => {
  try {
    const { email, password } = req.validated.body;
    const user = await User.findOne({ email });
    if (user && (await user.matchPassword(password))) {
      await sendAuthResponse(user, res);
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.linguist_refresh;
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token' });
    }
    const session = await findValidSession(refreshToken);
    if (!session) {
      return res.status(401).json({ message: 'Invalid refresh session' });
    }
    const user = await User.findById(session.user).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    const token = generateAccessToken(user._id);
    const profile = await formatUser(user);
    res.json({ token, ...profile });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', protect, async (req, res) => {
  try {
    await revokeSessionByCookie(req, res);
    res.json({ message: 'Logged out' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me', protect, async (req, res) => {
  res.status(200).json(await formatUser(req.user));
});

router.post('/onboard', protect, validate(onboardSchema), async (req, res) => {
  try {
    const { level, goal, planType } = req.validated.body;
    req.user.onboarding = {
      completed: true,
      level,
      goal,
      planType,
    };
    const updatedUser = await req.user.save();
    res.status(200).json(await formatUser(updatedUser));
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ message: 'Server error during onboarding' });
  }
});

router.post('/sync-quest', protect, validate(syncQuestSchema), async (req, res) => {
  try {
    const { type } = req.validated.body;
    const today = new Date().toISOString().split('T')[0];
    let isStreakUpdated = false;

    if (req.user.dailyQuests.date !== today) {
      req.user.dailyQuests = {
        date: today,
        reviewCompleted: false,
        topicCompleted: false,
        immersionCompleted: false,
      };

      if (req.user.lastActiveDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const lastActiveStr = req.user.lastActiveDate.toISOString().split('T')[0];
        if (lastActiveStr !== yesterdayStr && lastActiveStr !== today) {
          req.user.currentStreak = 0;
        }
      }
    }

    const questKeyMap = {
      review: 'reviewCompleted',
      topic: 'topicCompleted',
      immersion: 'immersionCompleted',
    };
    const questKey = questKeyMap[type];
    const wasAlreadyDone = req.user.dailyQuests[questKey];
    let xpAwarded = 0;

    if (!wasAlreadyDone) {
      req.user.xp += QUEST_STEP_XP;
      xpAwarded += QUEST_STEP_XP;
    }

    req.user.dailyQuests[questKey] = true;

    const { reviewCompleted, topicCompleted, immersionCompleted } = req.user.dailyQuests;
    const allCompletedNow = reviewCompleted && topicCompleted && immersionCompleted;
    const lastActiveStr = req.user.lastActiveDate
      ? req.user.lastActiveDate.toISOString().split('T')[0]
      : null;

    if (allCompletedNow && lastActiveStr !== today) {
      req.user.currentStreak += 1;
      req.user.xp += DAILY_BONUS_XP;
      xpAwarded += DAILY_BONUS_XP;
      req.user.lastActiveDate = new Date();
      if (req.user.currentStreak > req.user.longestStreak) {
        req.user.longestStreak = req.user.currentStreak;
      }
      isStreakUpdated = true;
    }

    const updatedUser = await req.user.save();
    const profile = await formatUser(updatedUser);
    res.status(200).json({
      user: profile,
      streakUpdated: isStreakUpdated,
      xpAwarded,
      message: isStreakUpdated
        ? `Kunlik reja tugadi! +${xpAwarded} XP va streak yangilandi`
        : xpAwarded > 0
          ? `Qadam bajarildi! +${xpAwarded} XP`
          : 'Quest synced.',
    });
  } catch (error) {
    console.error('Sync quest error:', error);
    res.status(500).json({ message: 'Server error during quest sync' });
  }
});

module.exports = router;
