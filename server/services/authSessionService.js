const Session = require('../models/Session');
const {
  generateRefreshToken,
  hashToken,
  setRefreshCookie,
  clearRefreshCookie,
  REFRESH_COOKIE,
  REFRESH_MS,
} = require('../utils/tokens');

/**
 * Parallel refresh uchun oraliq.
 *
 * Ikki tab (yoki tarmoq qayta urinishi) bir vaqtda eski cookie bilan
 * `/refresh` chaqirishi mumkin: birinchisi tokenni almashtiradi, ikkinchisi
 * esa allaqachon almashtirilgan tokenni yuboradi. Bu o'g'irlik emas —
 * shuning uchun qisqa oraliq ichida ikkinchi so'rovga yangi cookie
 * berilmaydi, faqat oiladagi eng so'nggi sessiyaga access token beriladi.
 */
const ROTATION_GRACE_MS = 20 * 1000;

/**
 * Almashtirilgan yozuv qancha saqlanadi. Har refresh yangi yozuv yaratadi,
 * shuning uchun eskilarini 30 kun saqlash bazani to'ldirib yuborardi.
 * Bu muddatdan keyin eski token shunchaki "yaroqsiz" bo'ladi.
 */
const ROTATED_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const clientMeta = (req) => ({
  userAgent: String(req?.headers?.['user-agent'] || '').slice(0, 256),
  ip: String(req?.ip || '').slice(0, 64),
});

const familyFilter = (session) => {
  const familyId = session.familyId || session._id;
  return { $or: [{ familyId }, { _id: familyId }] };
};

const isAlive = (session) =>
  Boolean(session) && !session.revokedAt && session.expiresAt > new Date();

/** Yangi sessiya (login, ro'yxatdan o'tish, parol almashtirish) */
const createSession = async (userId, req, res, { familyId } = {}) => {
  const refreshToken = generateRefreshToken();
  const session = await Session.create({
    user: userId,
    refreshTokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_MS),
    ...(familyId ? { familyId } : {}),
    ...clientMeta(req),
  });
  setRefreshCookie(res, refreshToken);
  return session;
};

/** Oiladagi eng so'nggi sessiya — `replacedBy` zanjiri bo'ylab */
const followReplacements = async (session) => {
  let current = session;
  const visited = new Set();
  while (current?.replacedBy) {
    const id = String(current._id);
    if (visited.has(id)) return null;
    visited.add(id);
    current = await Session.findById(current.replacedBy);
  }
  return current;
};

/**
 * Refresh tokenni almashtiradi.
 *
 * Natija:
 *  - `{ session }` — yangi cookie o'rnatildi, `session` bilan access token beriladi;
 *  - `{ session, reused: true }` — parallel so'rov, cookie o'zgarmaydi;
 *  - `{ error }` — 'INVALID_REFRESH' yoki 'REFRESH_REUSED' (oila yopildi).
 */
const rotateSession = async (rawToken, req, res) => {
  const session = await Session.findOne({ refreshTokenHash: hashToken(rawToken) });
  if (!session || session.expiresAt <= new Date()) {
    return { error: 'INVALID_REFRESH' };
  }

  if (session.revokedAt) {
    if (session.revokedReason !== 'rotated') {
      return { error: 'INVALID_REFRESH' };
    }
    const withinGrace = Date.now() - session.revokedAt.getTime() < ROTATION_GRACE_MS;
    if (withinGrace) {
      const latest = await followReplacements(session);
      if (isAlive(latest)) return { session: latest, reused: true };
      return { error: 'INVALID_REFRESH' };
    }

    // Almashtirilgan token qayta keldi — kimdir uning nusxasiga ega.
    // Qaysi biri haqiqiy egasi ekanini bilib bo'lmaydi, shuning uchun
    // butun oila yopiladi va ikkalasi ham qayta login qiladi.
    await revokeFamily(session, 'reuse_detected');
    console.warn(`[auth] refresh token qayta ishlatildi: user=${session.user} family=${session.familyId || session._id}`);
    return { error: 'REFRESH_REUSED' };
  }

  // Avval yangi yozuvni saqlaymiz: eski sessiya hech qachon hali mavjud
  // bo'lmagan replacedBy yozuviga ishora qilmasin. Saqlash xatosida eski
  // cookie amal qilishda davom etadi.
  const refreshToken = generateRefreshToken();
  const next = new Session({
    user: session.user,
    familyId: session.familyId || session._id,
    refreshTokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_MS),
    ...clientMeta(req),
  });
  await next.save();
  const now = Date.now();
  let claimed;
  try {
    // Atomik: ikki parallel so'rovdan faqat bittasi almashtira oladi
    claimed = await Session.findOneAndUpdate(
      { _id: session._id, revokedAt: null },
      {
        revokedAt: new Date(now),
        revokedReason: 'rotated',
        replacedBy: next._id,
        lastUsedAt: new Date(now),
        expiresAt: new Date(Math.min(session.expiresAt.getTime(), now + ROTATED_RETENTION_MS)),
      },
      { returnDocument: 'after' }
    );
  } catch (error) {
    await Session.deleteOne({ _id: next._id });
    throw error;
  }
  if (!claimed) {
    await Session.deleteOne({ _id: next._id });
    // Boshqa so'rov bizdan oldin almashtirdi — parallel holat
    const latest = await followReplacements(await Session.findById(session._id));
    if (isAlive(latest)) return { session: latest, reused: true };
    return { error: 'INVALID_REFRESH' };
  }

  setRefreshCookie(res, refreshToken);
  return { session: next };
};

/** Oilaning barcha yozuvlarini yopadi (sabab oldingisining ustiga yoziladi) */
const revokeFamily = async (session, reason) => {
  await Session.updateMany(familyFilter(session), {
    revokedAt: new Date(),
    revokedReason: reason,
  });
};

/**
 * Logout: cookie'dagi sessiya oilasini yopadi.
 * Access token talab qilinmaydi — muddati o'tgan bo'lsa ham chiqish ishlashi kerak.
 */
const revokeSessionByCookie = async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    const session = await Session.findOne({ refreshTokenHash: hashToken(token) });
    if (session) await revokeFamily(session, 'logout');
  }
  clearRefreshCookie(res);
};

/**
 * Access token hali ham amal qiladigan sessiyaga tegishlimi.
 *
 * `rotated` yozuv ham qabul qilinadi: refresh'dan oldin chiqarilgan access
 * token o'z 15 daqiqasini oxirigacha ishlaydi. Logout, parol almashtirish
 * yoki o'g'irlik aniqlanganda esa butun oila boshqa sabab bilan
 * yopiladi va token darhol kuchini yo'qotadi.
 */
const isSessionActive = async (sessionId, userId) => {
  const session = await Session.findOne({ _id: sessionId, user: userId })
    .select('revokedAt revokedReason expiresAt')
    .lean();
  if (!session || session.expiresAt <= new Date()) return false;
  return !session.revokedAt || session.revokedReason === 'rotated';
};

/**
 * Foydalanuvchining barcha sessiyalarini bekor qiladi.
 * Parol almashtirilganda chaqiriladi: hisobni kimdir egallagan bo'lsa,
 * uning refresh tokeni ham darhol kuchini yo'qotsin.
 */
const revokeAllSessionsForUser = async (userId, reason = 'password_change') => {
  await Session.updateMany({ user: userId }, { revokedAt: new Date(), revokedReason: reason });
};

module.exports = {
  createSession,
  rotateSession,
  revokeSessionByCookie,
  isSessionActive,
  revokeAllSessionsForUser,
  ROTATION_GRACE_MS,
};
