const { verifyAccessToken } = require('../utils/tokens');
const { isSessionActive } = require('../services/authSessionService');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }

  // `sid`siz token — yangilanishdan oldingi format. Mijoz 401 olib
  // refresh qiladi va yangi formatdagi token oladi.
  if (!decoded?.id || !decoded?.sid) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }

  try {
    const [active, user] = await Promise.all([
      isSessionActive(decoded.sid, decoded.id),
      User.findById(decoded.id).select('-password'),
    ]);
    if (!active) {
      return res.status(401).json({ message: 'Sessiya yopilgan', code: 'SESSION_REVOKED' });
    }
    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }
    req.user = user;
    req.sessionId = decoded.sid;
    next();
  } catch (error) {
    // Masalan buzilgan `sid` (ObjectId emas) — bu ham autentifikatsiya xatosi
    if (error?.name === 'CastError') {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
    next(error);
  }
};

module.exports = { protect };
