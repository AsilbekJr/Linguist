const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return process.env.JWT_SECRET;
};

const generateAccessToken = (id) =>
  jwt.sign({ id }, getJwtSecret(), { expiresIn: '15m' });

const generateRefreshToken = () => crypto.randomBytes(40).toString('hex');

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const verifyAccessToken = (token) => jwt.verify(token, getJwtSecret());

const REFRESH_COOKIE = 'linguist_refresh';
const REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

const setRefreshCookie = (res, token) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    // Cross-origin frontend (Vercel) + API (Render) requires SameSite=None
    sameSite: isProd ? 'none' : 'lax',
    maxAge: REFRESH_MS,
    path: '/api/auth',
  });
};

const clearRefreshCookie = (res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(REFRESH_COOKIE, {
    path: '/api/auth',
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
  });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyAccessToken,
  REFRESH_COOKIE,
  setRefreshCookie,
  clearRefreshCookie,
};
