const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const {
  validate,
  authRegisterSchema,
  authLoginSchema,
  onboardSchema,
  profileUpdateSchema,
  changePasswordSchema,
  deleteAccountSchema,
  timezoneSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  googleAuthSchema,
} = require('../middleware/validate');
// Modul obyekti orqali — testlar Google tekshiruvini almashtira olsin
const googleAuth = require('../services/googleAuth');
const {
  generateAccessToken,
  generateResetToken,
  hashToken,
  RESET_TOKEN_TTL_MS,
} = require('../utils/tokens');
const {
  createSession,
  rotateSession,
  revokeSessionByCookie,
  revokeAllSessionsForUser,
} = require('../services/authSessionService');
const { clearRefreshCookie, REFRESH_COOKIE } = require('../utils/tokens');
const PushSubscription = require('../models/PushSubscription');
const QuizSession = require('../models/QuizSession');
const PlacementSession = require('../models/PlacementSession');
const Challenge = require('../models/Challenge');
const Session = require('../models/Session');
const PasswordResetToken = require('../models/PasswordResetToken');
const EmailVerificationToken = require('../models/EmailVerificationToken');
const Conversation = require('../models/Conversation');
const Phrase = require('../models/Phrase');
const {
  sendVerificationEmail,
  verifyEmailToken,
  markEmailVerified,
} = require('../services/emailVerification');
const TopicProgress = require('../models/TopicProgress');
const { sendMail, passwordResetEmail } = require('../services/mailer');
const { getStartDayForLevel } = require('../utils/topicHelpers');
const fs = require('fs');
const path = require('path');
const Word = require('../models/Word');
const { isValidTimeZone } = require('../utils/dayKey');
const { buildUserProfile } = require('../utils/userProfile');

const formatUser = buildUserProfile;

const sendAuthResponse = async (user, req, res, status = 200) => {
  const session = await createSession(user._id, req, res);
  const token = generateAccessToken(user._id, session._id);
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
    // TODO(B bosqich): email tasdiqlash qo'shilgach bu javob umumiy bo'ladi
    // ("pochtangizni tekshiring"), band email egasiga esa xat ketadi. Hozir
    // buni yashirsak, odam ro'yxatdan o'tdim deb o'ylab qolardi.
    if (userExists) {
      return res.status(409).json({ message: 'User already exists', code: 'EMAIL_TAKEN' });
    }
    const user = await User.create({ name, email, password });
    await sendAuthResponse(user, req, res, 201);

    // Javobni kutdirmaymiz: pochta sekin yoki ishlamasa ham ro'yxatdan o'tish
    // darhol tugaydi, xatni esa bannerdan qayta so'rash mumkin
    sendVerificationEmail(user).catch((error) => {
      console.error('Tasdiqlash xati yuborilmadi:', error.message);
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/login', validate(authLoginSchema), async (req, res) => {
  try {
    const { email, password } = req.validated.body;
    const user = await User.findOne({ email });
    const valid = user
      ? await user.matchPassword(password)
      : await User.fakePasswordCheck(password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    // Eski (kuchsizroq) hash'ni ochiq parol qo'limizda bo'lgan yagona payt
    if (user.needsRehash()) {
      user.password = password;
      await user.save();
    }
    await sendAuthResponse(user, req, res);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      return res.status(401).json({
        message: 'Refresh cookie yo\'q. Qayta login qiling.',
        code: 'NO_REFRESH_COOKIE',
      });
    }
    const { session, error } = await rotateSession(refreshToken, req, res);
    if (error) {
      clearRefreshCookie(res);
      return res.status(401).json({
        message: 'Sessiya tugagan. Qayta login qiling.',
        code: error,
      });
    }
    const user = await User.findById(session.user).select('-password');
    if (!user) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: 'User not found', code: 'INVALID_REFRESH' });
    }

    const token = generateAccessToken(user._id, session._id);
    const profile = await formatUser(user);
    res.json({ token, ...profile });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Access token talab qilinmaydi: u muddati o'tgan bo'lsa ham chiqish
// ishlashi kerak. Sessiya refresh cookie orqali topiladi.
router.post('/logout', async (req, res) => {
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
      ...(req.user.onboarding?.toObject?.() || req.user.onboarding || {}),
      completed: true,
      level,
      goal,
      planType,
    };
    const updatedUser = await req.user.save();

    // Kurs boshlanishini darajaga moslaymiz. Ilgari bu qilinmasdi va
    // `resolveTopicDay` ham darajani e'tiborsiz qoldirardi — natijada
    // "advanced" tanlagan foydalanuvchi ham 1-kun "Tanishuv" (A1) dan boshlardi.
    const progress = await TopicProgress.findOne({ user: req.user._id });
    if (!progress || progress.history.length === 0) {
      const topicsList = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../data/topics.json'), 'utf8')
      );
      const startDay = getStartDayForLevel(topicsList, level);
      if (progress) {
        progress.currentDay = startDay;
        await progress.save();
      } else {
        await TopicProgress.create({ user: req.user._id, currentDay: startDay, history: [] });
      }
    }

    res.status(200).json(await formatUser(updatedUser));
  } catch (error) {
    console.error('Onboarding error:', error);
    res.status(500).json({ message: 'Server error during onboarding' });
  }
});

// ─── Profil va hisob ───────────────────────────────────────────────────────
//
// Ilgari onboarding "ma'lumotlarni keyinroq o'zgartirishingiz mumkin" deb
// va'da qilardi, lekin bunday imkon umuman yo'q edi: ism, daraja va maqsadni
// o'zgartirib bo'lmasdi, parolni faqat "unutdim" orqali almashtirish mumkin
// edi, hisobni o'chirish esa yo'q edi.

// @desc    Profilni tahrirlash (ism, daraja, maqsad, reja)
// @route   PATCH /api/auth/profile
router.patch('/profile', protect, validate(profileUpdateSchema), async (req, res) => {
  try {
    const { name, level, goal, planType } = req.validated.body;
    if (name !== undefined) req.user.name = name;

    // Daraja o'zgarsa kurs qaytadan BOSHLANMAYDI — faqat AI izohlari
    // murakkabligi o'zgaradi. Kursni qayta boshlash o'tilgan
    // kunlarni yo'qotish bo'lardi. Kunlik so'zlar sonini endi reja (planType) belgilaydi.
    if (level !== undefined) req.user.onboarding.level = level;
    if (goal !== undefined) req.user.onboarding.goal = goal;
    if (planType !== undefined) req.user.onboarding.planType = planType;

    await req.user.save();
    res.json(await formatUser(req.user));
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Parolni o'zgartirish (joriy parol bilan)
// @route   POST /api/auth/change-password
router.post('/change-password', protect, validate(changePasswordSchema), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.validated.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ message: 'User not found' });
    // Google orqali ochilgan hisob: birinchi parol joriy parolsiz o'rnatiladi
    const settingFirstPassword = !user.password;
    if (!settingFirstPassword && !(currentPassword && (await user.matchPassword(currentPassword)))) {
      return res.status(400).json({ message: "Joriy parol noto'g'ri.", code: 'WRONG_PASSWORD' });
    }
    if (!settingFirstPassword && currentPassword === newPassword) {
      return res.status(400).json({ message: 'Yangi parol eskisidan farq qilishi kerak.', code: 'SAME_PASSWORD' });
    }

    user.password = newPassword;
    await user.save();

    // Boshqa qurilmalardagi sessiyalar yopiladi (hisobni kimdir egallagan
    // bo'lsa, u chiqarib yuboriladi), joriy qurilma esa yangi sessiya oladi.
    await revokeAllSessionsForUser(user._id, 'password_change');
    const session = await createSession(user._id, req, res);

    res.json({
      message: settingFirstPassword
        ? "Parol o'rnatildi. Endi email va parol bilan ham kira olasiz."
        : "Parol o'zgartirildi. Boshqa qurilmalardan chiqildi.",
      token: generateAccessToken(user._id, session._id),
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Hisobni va unga tegishli barcha ma'lumotni o'chirish
// @route   DELETE /api/auth/account
router.delete('/account', protect, validate(deleteAccountSchema), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { password, confirmEmail } = req.validated.body;
    if (!user) return res.status(401).json({ message: 'User not found' });
    if (user.password) {
      if (!password || !(await user.matchPassword(password))) {
        return res.status(400).json({ message: "Parol noto'g'ri.", code: 'WRONG_PASSWORD' });
      }
    } else if (confirmEmail !== user.email) {
      // Parolsiz (Google) hisob — tasodifan o'chirmaslik uchun emailni yozdiramiz
      return res.status(400).json({ message: "Email mos kelmadi.", code: 'WRONG_CONFIRM_EMAIL' });
    }

    // Faol pullik obuna bo'lsa, avval uni bekor qilish kerak — aks holda
    // hisob yo'qoladi, Stripe esa har oy pul yechishda davom etadi.
    const plan = user.getEffectivePlan?.() || 'free';
    if (plan !== 'free' && user.subscription?.status === 'active') {
      return res.status(409).json({
        message: "Avval pullik obunani bekor qiling (Tariflar → Obunani boshqarish), keyin hisobni o'chiring.",
        code: 'ACTIVE_SUBSCRIPTION',
      });
    }

    const userId = user._id;
    // To'lov hodisalari (BillingEvent) ataylab qoldiriladi: ular moliyaviy
    // hisobot uchun kerak va shaxsiy ma'lumot saqlamaydi.
    await Promise.all(
      [Word, TopicProgress, Session, PasswordResetToken, EmailVerificationToken, Conversation, Phrase, PushSubscription, QuizSession, PlacementSession, Challenge].map(
        (Model) => Model.deleteMany({ user: userId })
      )
    );
    await User.deleteOne({ _id: userId });
    clearRefreshCookie(res);

    res.json({ message: "Hisob o'chirildi." });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// /sync-quest olib tashlandi: u mijozga ishonardi — ikki so'rov bilan XP va
// streak olish mumkin edi. Kunlik reja qadamlarini endi server o'zi belgilaydi
// (`completeDailyStep`, utils/gamification.js).

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
    // Tiklash havolasi pochtaga keldi — demak email egasi shu odam
    await markEmailVerified(user);
    await user.save();

    // Token bir martalik
    record.usedAt = new Date();
    await record.save();

    // Barcha ochiq sessiyalarni yopamiz: agar hisobni kimdir egallagan bo'lsa,
    // parol almashishi bilan uning refresh tokeni ham kuchini yo'qotsin.
    await revokeAllSessionsForUser(user._id, 'password_change');
    clearRefreshCookie(res);

    // Qaysi hisob tiklangani to'liq ko'rsatiladi. Bu xavfsiz: javobni faqat
    // xatdagi tokenga, ya'ni o'sha pochta qutisiga ega odam oladi. Kerakligi:
    // Gmail nuqtalar va `+teg`ni e'tiborsiz qoldiradi — `ali.v@gmail.com` va
    // `aliv@gmail.com` bitta qutiga keladi, lekin bizda bu ikki xil hisob.
    res.json({
      message: "Parol yangilandi. Endi yangi parol bilan kiring.",
      account: user.email,
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Google orqali kirish / ro'yxatdan o'tish
// @route   POST /api/auth/google
router.post('/google', validate(googleAuthSchema), async (req, res) => {
  if (!googleAuth.isGoogleConfigured()) {
    return res.status(503).json({ message: 'Google orqali kirish sozlanmagan.', code: 'GOOGLE_NOT_CONFIGURED' });
  }
  try {
    const google = await googleAuth.verifyGoogleCredential(req.validated.body.credential);
    if (google.error) {
      return res.status(401).json({
        message:
          google.error === 'GOOGLE_EMAIL_NOT_VERIFIED'
            ? 'Google hisobingizdagi email tasdiqlanmagan.'
            : "Google orqali kirib bo'lmadi. Qayta urinib ko'ring.",
        code: google.error,
      });
    }

    let created = false;
    let user = await User.findOne({ googleId: google.googleId });

    if (!user) {
      user = await User.findOne({ email: google.email });
      if (user) {
        /**
         * Mavjud hisobga bog'lash.
         *
         * Hisob emaili tasdiqlanmagan bo'lsa, uni boshqa odam ochgan bo'lishi
         * mumkin ("oldindan egallash"): hujumchi sizning gmail'ingiz bilan
         * parol qo'yib ro'yxatdan o'tadi, siz Google bilan kirasiz, u esa
         * o'z paroli bilan kirishda davom etadi. Shuning uchun bunday holatda
         * eski parol o'chiriladi va barcha sessiyalar yopiladi. Haqiqiy egasi
         * keyin Sozlamalar'da o'z parolini o'rnatadi.
         */
        if (!user.emailVerified) {
          user.password = undefined;
          await revokeAllSessionsForUser(user._id, 'revoked');
          await markEmailVerified(user);
        }
        user.googleId = google.googleId;
        await user.save();
      } else {
        user = await User.create({
          name: google.name.length >= 2 ? google.name : google.email.split('@')[0],
          email: google.email,
          googleId: google.googleId,
          hasPassword: false,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        });
        created = true;
      }
    }

    await sendAuthResponse(user, req, res, created ? 201 : 200);
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Emailni tasdiqlash (xatdagi havola)
// @route   POST /api/auth/verify-email
// Login talab qilmaydi: xat ko'pincha telefonda ochiladi, ilova esa
// kompyuterda ochiq bo'ladi.
router.post('/verify-email', validate(verifyEmailSchema), async (req, res) => {
  try {
    const { user, alreadyVerified, error } = await verifyEmailToken(req.validated.body.token);
    if (error) {
      return res.status(400).json({
        message: "Havola yaroqsiz yoki muddati tugagan. Ilovadan yangi havola so'rang.",
        code: error,
      });
    }
    res.json({
      message: alreadyVerified ? 'Email allaqachon tasdiqlangan.' : 'Email tasdiqlandi.',
      alreadyVerified: Boolean(alreadyVerified),
      // Faqat tokenga (pochta qutisiga) ega odam ko'radi — qaysi hisob ekani aniq bo'lsin
      account: user.email,
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @desc    Tasdiqlash xatini qayta yuborish
// @route   POST /api/auth/resend-verification
router.post('/resend-verification', protect, async (req, res) => {
  try {
    const result = await sendVerificationEmail(req.user);
    if (result.reason === 'ALREADY_VERIFIED') {
      return res.json({ message: 'Email allaqachon tasdiqlangan.', alreadyVerified: true });
    }
    if (result.reason === 'COOLDOWN') {
      res.set('Retry-After', String(result.retryAfterSec));
      return res.status(429).json({
        message: `Xat hozirgina yuborildi. ${result.retryAfterSec} soniyadan keyin qayta urinib ko'ring.`,
        code: 'VERIFY_COOLDOWN',
        retryAfterSec: result.retryAfterSec,
      });
    }
    if (!result.sent) {
      return res.status(503).json({
        message: "Xatni hozir yuborib bo'lmadi. Birozdan keyin qayta urinib ko'ring.",
        code: 'MAIL_FAILED',
      });
    }
    res.json({ message: `Tasdiqlash xati ${req.user.email} manziliga yuborildi.` });
  } catch (error) {
    console.error('Resend verification error:', error);
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
