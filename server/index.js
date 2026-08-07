const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('./config/db');
const { validateEnv } = require('./utils/validateEnv');
const { createApp } = require('./app');

validateEnv();

const app = createApp();
const PORT = process.env.PORT || 5000;
const isProd = process.env.NODE_ENV === 'production';

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
