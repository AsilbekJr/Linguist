const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const {
  validate,
  authRegisterSchema,
  authLoginSchema,
  onboardSchema,
  syncQuestSchema,
  timezoneSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} = require('../middleware/validate');
const {
  generateAccessToken,
  generateResetToken,
  hashToken,
  RESET_TOKEN_TTL_MS,
} = require('../utils/tokens');
const {
  createSession,
  revokeSessionByCookie,
  findValidSession,
  revokeAllSessionsForUser,
} = require('../services/authSessionService');
const PasswordResetToken = require('../models/PasswordResetToken');
const { sendMail, passwordResetEmail } = require('../services/mailer');
const Word = require('../models/Word');
const { userDayKey, isValidTimeZone } = require('../utils/dayKey');
const {
  enrichUserProfile,
  advanceStreak,
  rollDailyQuests,
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
      return res.status(401).json({
        message: 'Refresh cookie yo\'q. Qayta login qiling.',
        code: 'NO_REFRESH_COOKIE',
      });
    }
    const session = await findValidSession(refreshToken);
    if (!session) {
      return res.status(401).json({
        message: 'Sessiya tugagan. Qayta login qiling.',
        code: 'INVALID_REFRESH',
      });
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
    // Foydalanuvchi zonasidagi kun. Ilgari UTC ishlatilardi va O'zbekistonda
    // "kun" mahalliy soat 05:00 da almashib, kechqurungi mashq ertangi kunga yozilardi.
    const today = userDayKey(req.user);

    rollDailyQuests(req.user, today);

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

    let streakResult = { changed: false, streakFrozen: false };
    if (allCompletedNow) {
      streakResult = advanceStreak(req.user, today);
      if (streakResult.changed) {
        req.user.xp += DAILY_BONUS_XP;
        xpAwarded += DAILY_BONUS_XP;
      }
    }

    const updatedUser = await req.user.save();
    const profile = await formatUser(updatedUser);

    let message = 'Quest synced.';
    if (streakResult.changed && streakResult.streakFrozen) {
      message = `Kunlik reja tugadi! +${xpAwarded} XP · Streak muzlatish ishlatildi, ketma-ketlik saqlandi 🧊`;
    } else if (streakResult.changed) {
      message = `Kunlik reja tugadi! +${xpAwarded} XP va streak yangilandi`;
    } else if (xpAwarded > 0) {
      message = `Qadam bajarildi! +${xpAwarded} XP`;
    }

    res.status(200).json({
      user: profile,
      streakUpdated: streakResult.changed,
      streakFrozen: streakResult.streakFrozen,
      xpAwarded,
      message,
    });
  } catch (error) {
    console.error('Sync quest error:', error);
    res.status(500).json({ message: 'Server error during quest sync' });
  }
});

// @desc    Parolni tiklash havolasini yuborish
// @route   POST /api/auth/forgot-password
router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res) => {
  const { email } = req.validated.body;

  // MUHIM: javob har doim bir xil. Aks holda bu endpoint "bu email
  // ro'yxatdan o'tganmi?" degan savolga javob beradigan vositaga aylanadi
  // va foydalanuvchilar ro'yxatini yig'ish mumkin bo'ladi.
  const genericResponse = {
    message:
      "Agar bu email ro'yxatdan o'tgan bo'lsa, tiklash havolasi yuborildi. Pochtangizni tekshiring.",
  };

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.json(genericResponse);
    }

    // Eski faol tokenlarni bekor qilamiz — bir vaqtda faqat bitta havola ishlasin
    await PasswordResetToken.updateMany(
      { user: user._id, usedAt: null },
      { usedAt: new Date() }
    );

    const rawToken = generateResetToken();
    await PasswordResetToken.create({
      user: user._id,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password?token=${rawToken}`;
    const mail = passwordResetEmail(user.name, resetUrl);

    await sendMail({ to: user.email, ...mail });

    res.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    // Bu yerda ham umumiy javob — xato ham ma'lumot oshkor qilmasin
    res.json(genericResponse);
  }
});

// @desc    Yangi parolni o'rnatish
// @route   POST /api/auth/reset-password
router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
  try {
    const { token, password } = req.validated.body;

    const record = await PasswordResetToken.findOne({
      tokenHash: hashToken(token),
      usedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!record) {
      return res.status(400).json({
        message: "Havola yaroqsiz yoki muddati tugagan. Yangi havola so'rang.",
        code: 'INVALID_RESET_TOKEN',
      });
    }

    const user = await User.findById(record.user);
    if (!user) {
      return res.status(400).json({ message: 'Foydalanuvchi topilmadi' });
    }

    user.password = password; // pre('save') hash qiladi
    await user.save();

    // Token bir martalik
    record.usedAt = new Date();
    await record.save();

    // Barcha ochiq sessiyalarni yopamiz: agar hisobni kimdir egallagan bo'lsa,
    // parol almashishi bilan uning refresh tokeni ham kuchini yo'qotsin.
    await revokeAllSessionsForUser(user._id);

    res.json({ message: "Parol yangilandi. Endi yangi parol bilan kiring." });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Vaqt zonasini saqlash — mijoz Intl orqali aniqlaydi
// @route   POST /api/auth/timezone
router.post('/timezone', protect, validate(timezoneSchema), async (req, res) => {
  try {
    const { timezone } = req.validated.body;
    if (!isValidTimeZone(timezone)) {
      return res.status(400).json({ message: 'Yaroqsiz vaqt zonasi' });
    }
    if (req.user.timezone !== timezone) {
      req.user.timezone = timezone;
      await req.user.save();
    }
    res.json({ timezone: req.user.timezone });
  } catch (error) {
    console.error('Timezone update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
