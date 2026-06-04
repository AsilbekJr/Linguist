const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');

dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is required.');
  process.exit(1);
}

const wordRoutes = require('./routes/wordRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const speakingRoutes = require('./routes/speakingRoutes');
const roleplayRoutes = require('./routes/roleplayRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const challengeRoutes = require('./routes/challengeRoutes');
const authRoutes = require('./routes/authRoutes');
const practiceRoutes = require('./routes/practiceRoutes');
const billingRoutes = require('./routes/billingRoutes');
const billingWebhook = require('./routes/billingWebhook');

const app = express();

const isProd = process.env.NODE_ENV === 'production';
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(hpp());

app.use(cors({
  origin: isProd ? allowedOrigin : [allowedOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

app.use(
  '/api/billing/webhook',
  express.raw({ type: 'application/json' }),
  billingWebhook
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 100 : 500,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 10 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many auth attempts. Try again later.' },
});

app.use(globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Linguist AI-Flow API' });
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Linguist AI-Flow API' });
});

app.use('/api/words', wordRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/speaking', speakingRoutes);
app.use('/api/roleplay', roleplayRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/challenge', challengeRoutes);
app.use('/api/topics', require('./routes/topicVocabRoutes'));
app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes);

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    message: isProd ? 'Server error' : err.message,
  });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (${isProd ? 'production' : 'development'})`);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
