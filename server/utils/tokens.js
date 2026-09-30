const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return process.env.JWT_SECRET;
};

/**
 * JWT parametrlari qat'iy belgilanadi: algoritm, issuer va audience
 * tekshirilmasa, boshqa maqsadda (yoki boshqa algoritm bilan) imzolangan
 * token ham qabul qilinib qolishi mumkin.
 */
const JWT_OPTIONS = {
  algorithm: 'HS256',
  issuer: 'linguist-api',
  audience: 'linguist-app',
};

/**
 * `sid` — token qaysi sessiyaga tegishli. Busiz logout yoki parol
 * almashgandan keyin ham access token muddati tugaguncha ishlayverardi.
 */
const generateAccessToken = (id, sessionId) =>
  jwt.sign({ id: String(id), sid: String(sessionId) }, getJwtSecret(), {
    ...JWT_OPTIONS,
    expiresIn: '15m',
  });

const generateRefreshToken = () => crypto.randomBytes(40).toString('hex');

/** Parolni tiklash tokeni — URL'ga tushadi, shuning uchun hex */
const generateResetToken = () => crypto.randomBytes(32).toString('hex');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 soat
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 soat — xat kechroq ochilishi mumkin

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const verifyAccessToken = (token) =>
  jwt.verify(token, getJwtSecret(), {
    algorithms: [JWT_OPTIONS.algorithm],
    issuer: JWT_OPTIONS.issuer,
    audience: JWT_OPTIONS.audience,
  });

const REFRESH_COOKIE = 'linguist_refresh';
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Cookie'ning SameSite qiymati.
 *
 * Frontend va backend turli saytlarda bo'lsa (vercel.app + onrender.com)
 * `none` majburiy — lekin bunday cookie'ni Safari va boshqa brauzerlar
 * "uchinchi tomon" deb bloklaydi. Ikkalasi bitta sayt ostiga olingach
 * (app.domen.uz + api.domen.uz yoki Vercel proxy) `COOKIE_SAMESITE=lax`
 * qo'yiladi: cookie birinchi tomon bo'ladi va CSRF'dan ham himoya qiladi.
 */
const getCookieOptions = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const configured = String(process.env.COOKIE_SAMESITE || '').toLowerCase();
  const sameSite = ['lax', 'strict', 'none'].includes(configured)
    ? configured
    : isProd
      ? 'none'
      : 'lax';
  return {
    httpOnly: true,
    // SameSite=None faqat Secure bilan ishlaydi
    secure: isProd || sameSite === 'none',
    sameSite,
    path: '/api/auth',
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
};

const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE, token, { ...getCookieOptions(), maxAge: REFRESH_MS });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE, getCookieOptions());
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  generateResetToken,
  RESET_TOKEN_TTL_MS,
  VERIFY_TOKEN_TTL_MS,
  hashToken,
  verifyAccessToken,
  REFRESH_COOKIE,
  REFRESH_MS,
  setRefreshCookie,
  clearRefreshCookie,
};
