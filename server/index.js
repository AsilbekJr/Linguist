const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('./config/db');
const { validateEnv } = require('./utils/validateEnv');
const { createApp } = require('./app');
const { startInternalCron } = require('./services/reminderRunner');

validateEnv();

const app = createApp();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

const startServer = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} (${isProd ? 'production' : 'development'})`);
    // Ixtiyoriy: tashqi cron o'rniga ichki interval.
    // Render bepul tarifida servis bo'sh turishda o'chadi, shuning uchun
    // ishonchli variant — tashqi cron POST /api/notifications/run ni chaqirishi.
    startInternalCron();
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
