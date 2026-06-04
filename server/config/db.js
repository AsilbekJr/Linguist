const mongoose = require('mongoose');

let memoryServer = null;

const connectMemoryDb = async () => {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create();
  const conn = await mongoose.connect(memoryServer.getUri());
  console.log('MongoDB Connected (in-memory — faqat local dev uchun)');
  return conn;
};

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  const devMemory =
    process.env.NODE_ENV !== 'production' &&
    (process.env.USE_MEMORY_DB === 'true' || process.env.USE_MEMORY_DB === 'auto');

  if (devMemory && process.env.USE_MEMORY_DB === 'true') {
    return connectMemoryDb();
  }

  if (!uri) {
    console.error('FATAL: MONGO_URI is required in server/.env');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.warn(`MongoDB connection failed: ${error.message}`);

    if (devMemory && process.env.USE_MEMORY_DB === 'auto') {
      console.warn('USE_MEMORY_DB=auto — in-memory MongoDB ishlatilmoqda...');
      return connectMemoryDb();
    }

    if (error.message.includes('ECONNREFUSED') || error.message.includes('querySrv')) {
      console.error(
        'Hint: Atlas tarmoq/IP muammosi. server/.env da USE_MEMORY_DB=auto qo\'ying (dev) yoki Atlas Network Access ni tekshiring.'
      );
    }
    process.exit(1);
  }
};

module.exports = connectDB;
