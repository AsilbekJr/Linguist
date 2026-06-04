const Session = require('../models/Session');
const {
  generateRefreshToken,
  hashToken,
  setRefreshCookie,
  clearRefreshCookie,
} = require('../utils/tokens');

const REFRESH_MS = 30 * 24 * 60 * 60 * 1000;

const createSession = async (userId, res) => {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);

  await Session.create({
    user: userId,
    refreshTokenHash,
    expiresAt: new Date(Date.now() + REFRESH_MS),
  });

  setRefreshCookie(res, refreshToken);
  return refreshToken;
};

const revokeSessionByCookie = async (req, res) => {
  const token = req.cookies?.linguist_refresh;
  if (token) {
    const hash = hashToken(token);
    await Session.updateOne(
      { refreshTokenHash: hash, revokedAt: null },
      { revokedAt: new Date() }
    );
  }
  clearRefreshCookie(res);
};

const findValidSession = async (refreshToken) => {
  const hash = hashToken(refreshToken);
  return Session.findOne({
    refreshTokenHash: hash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
};

module.exports = {
  createSession,
  revokeSessionByCookie,
  findValidSession,
};
