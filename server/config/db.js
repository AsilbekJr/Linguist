const mongoose = require('mongoose');

let memoryServer = null;

const connectMemoryDb = async () => {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create();
  const conn = await mongoose.connect(memoryServer.getUri());
  console.log('MongoDB Connected (in-memory — faqat local dev uchun)');
  return conn;
};

/** URI'dagi host (login/parolsiz) — logga xavfsiz chiqarish uchun */
const hostOf = (uri) => {
  const match = String(uri || '').match(/@([^/?]+)/);
  return match ? match[1] : '(noma\'lum host)';
};

/**
 * Ulanish xatosining HAQIQIY sababini aytadi.
 *
 * Ilgari har qanday `querySrv` xatosiga "Atlas tarmoq/IP muammosi" deyilardi.
 * Lekin `querySrv ENOTFOUND` — bu klaster manzili DNS'da umuman YO'Q degani
 * (klaster o'chirilgan yoki URI noto'g'ri). IP ro'yxatini o'zgartirish buni
 * tuzatmaydi va odam noto'g'ri joyda vaqt yo'qotadi.
 */
const diagnoseMongoError = (error, uri) => {
  const msg = String(error?.message || '');
  const host = hostOf(uri);

  if (/querySrv ENOTFOUND|ENOTFOUND/.test(msg)) {
    return (
      `"${host}" manzili DNS'da topilmadi — Atlas klaster mavjud emas ` +
      "yoki ishlamayapti: PAUZA qilingan (bepul M0 klaster uzoq faolsizlikdan keyin pauza bo'ladi — " +
      "Atlas'da Resume bosing), o'chirilgan yoki MONGO_URI xato yozilgan. IP ro'yxati bu " +
      "xatoga sabab EMAS. Atlas → Database → Connect → Drivers dan yangi connection " +
      "string oling va MONGO_URI'ni yangilang (Render: Environment bo'limida)."
    );
  }
  if (/bad auth|Authentication failed/i.test(msg)) {
    return "Login yoki parol noto'g'ri. Atlas → Database Access dagi foydalanuvchini tekshiring " +
      "(parolda @ : / kabi belgilar bo'lsa, URI'da URL-encode qilinishi kerak).";
  }
  if (/ECONNREFUSED|ETIMEDOUT|Server selection timed out|whitelist|IP/i.test(msg)) {
    return "Server klasterga yetib bora olmadi. Atlas → Network Access da serverning IP " +
      "manziliga ruxsat bering (Render bepul tarifida IP doimiy emas — 0.0.0.0/0 kerak).";
  }
  return 'MONGO_URI va Atlas klaster holatini tekshiring. Lokal ishlab chiqishda USE_MEMORY_DB=auto ishlatish mumkin.';
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

    console.error(`Hint: ${diagnoseMongoError(error, uri)}`);
    process.exit(1);
  }
};

module.exports = connectDB;
