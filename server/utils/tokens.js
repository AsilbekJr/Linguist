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
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: REFRESH_MS,
    path: '/api/auth',
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
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
