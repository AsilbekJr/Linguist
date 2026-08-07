const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const { getCorsOptions, corsRejectionHandler } = require('./utils/corsConfig');

/**
 * Express ilovasini quradi. `index.js` dan ajratildi — busiz integratsion
 * testlar haqiqiy portni band qilmasdan ilovani ishga tushira olmasdi.
 */
const createApp = ({ isProd = process.env.NODE_ENV === 'production', enableRateLimit = true } = {}) => {
  const app = express();

  if (isProd) {
    app.set('trust proxy', 1);
  }

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );
  app.use(hpp());
  app.use(cors(getCorsOptions(isProd)));
  // CORS'dan o'tmagan so'rovga "Failed to fetch" o'rniga aniq sabab
  app.use(corsRejectionHandler(isProd));

  // Webhook xom body talab qiladi — json parser'dan OLDIN turishi shart
  app.use(
    '/api/billing/webhook',
    express.raw({ type: 'application/json' }),
    require('./routes/billingWebhook')
  );

  app.use(cookieParser());
  // Audio base64 uchun kerak, lekin Zod darajasida 3.5MB cheklov bor (validate.js)
  app.use(express.json({ limit: '6mb' }));
  app.use(express.urlencoded({ limit: '6mb', extended: true }));

  // Express 5: express-mongo-sanitize middleware req.query ni buzadi — faqat body/params
  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = mongoSanitize.sanitize(req.body);
    }
    if (req.params && typeof req.params === 'object') {
      req.params = mongoSanitize.sanitize(req.params);
    }
    next();
  });

  if (enableRateLimit) {
    const globalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: isProd ? 300 : 1000,
      standardHeaders: true,
      legacyHeaders: false,
    });
    /**
     * Auth cheklovi.
     *
     * Ilgari bitta `authLimiter` login va register'ga BIRGA qo'llanardi,
     * ya'ni ular 10 ta urinishlik umumiy byudjetni bo'lishardi. Bundan
     * tashqari muvaffaqiyatli kirishlar ham hisoblanardi — bu esa
     * brute-force'dan himoya emas, oddiy foydalanuvchiga to'siq.
     *
     * Endi: alohida hisoblagichlar + faqat MUVAFFAQIYATSIZ urinishlar.
     */
    const makeAuthLimiter = (max, name) =>
      rateLimit({
        windowMs: 15 * 60 * 1000,
        max: Number(process.env[`RATE_LIMIT_${name}`]) || (isProd ? max : 500),
        standardHeaders: true,
        legacyHeaders: false,
        // Muvaffaqiyatli so'rov limitni yemaydi — hujumchi baribir
        // parolni bilmagani uchun uning urinishlari hisoblanaveradi
        skipSuccessfulRequests: true,
        message: {
          message: "Juda ko'p muvaffaqiyatsiz urinish. 15 daqiqadan keyin qayta urinib ko'ring.",
          code: 'RATE_LIMITED',
        },
      });

    const loginLimiter = makeAuthLimiter(20, 'LOGIN');
    const registerLimiter = makeAuthLimiter(10, 'REGISTER');

    // Parolni tiklash alohida va qattiqroq cheklanadi:
    // — /forgot-password spam yuborish vositasiga aylanmasin
    // — /reset-password tokenni taxmin qilishga urinishdan himoyalansin
    const passwordResetLimiter = rateLimit({
      windowMs: 60 * 60 * 1000,
      max: isProd ? 5 : 100,
      standardHeaders: true,
      legacyHeaders: false,
      message: { message: "Juda ko'p urinish. Bir soatdan keyin qayta urinib ko'ring." },
    });

    app.use(globalLimiter);
    app.use('/api/auth/login', loginLimiter);
    app.use('/api/auth/register', registerLimiter);
    // Refresh ham cheklanadi — ilgari cheklovsiz edi va cookie brute-force'ga ochiq qolardi
    app.use('/api/auth/refresh', makeAuthLimiter(60, 'REFRESH'));
    app.use('/api/auth/forgot-password', passwordResetLimiter);
    app.use('/api/auth/reset-password', passwordResetLimiter);
  }

  /**
   * Sog'liq va konfiguratsiya holati.
   *
   * Maxfiy qiymatlar QAYTARILMAYDI — faqat "sozlanganmi" degan boolean.
   * Bu deploydan keyingi eng ko'p uchraydigan muammoni (env o'zgaruvchisi
   * yozilmagan) bir so'rov bilan aniqlash imkonini beradi; aks holda
   * sababni Render loglaridan qidirishga to'g'ri keladi.
   */
  app.get('/health', (req, res) => {
    const { getAllowedOrigins } = require('./utils/corsConfig');
    res.json({
      status: 'ok',
      service: 'Linguist AI-Flow API',
      env: isProd ? 'production' : 'development',
      config: {
        mongo: Boolean(process.env.MONGO_URI),
        jwtSecret: Boolean(process.env.JWT_SECRET),
        gemini: Boolean(process.env.GEMINI_API_KEY),
        mail: Boolean(process.env.RESEND_API_KEY || process.env.BREVO_API_KEY),
        push: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
        cron: Boolean(process.env.CRON_SECRET),
      },
      // Aynan shu ro'yxatga tushmagan origin CORS'da rad etiladi
      allowedOrigins: getAllowedOrigins(isProd),
      requestOrigin: req.headers.origin || null,
    });
  });
  app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'Linguist AI-Flow API' });
  });

  app.use('/api/words', require('./routes/wordRoutes'));
  app.use('/api/review', require('./routes/reviewRoutes'));
  app.use('/api/practice', require('./routes/practiceRoutes'));
  app.use('/api/speaking', require('./routes/speakingRoutes'));
  app.use('/api/listening', require('./routes/listeningRoutes'));
  app.use('/api/placement', require('./routes/placementRoutes'));
  app.use('/api/notifications', require('./routes/notificationRoutes'));
  app.use('/api/push', require('./routes/pushRoutes'));
  app.use('/api/roleplay', require('./routes/roleplayRoutes'));
  app.use('/api/teacher', require('./routes/teacherRoutes'));
  app.use('/api/challenge', require('./routes/challengeRoutes'));
  app.use('/api/topics', require('./routes/topicVocabRoutes'));
  app.use('/api/auth', require('./routes/authRoutes'));
  app.use('/api/billing', require('./routes/billingRoutes'));

  app.use((req, res) => {
    res.status(404).json({ message: 'Not found' });
  });

  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      message: isProd ? 'Server error' : err.message,
    });
  });

  return app;
};

module.exports = { createApp };
