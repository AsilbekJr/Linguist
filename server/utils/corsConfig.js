/**
 * Builds CORS options for credentialed cross-origin requests (cookies + Authorization).
 * Wildcard (*) origins are rejected — browsers block * when credentials: 'include'.
 */

/** Fixes common typos like https//host → https://host */
const normalizeOrigin = (value) => {
  if (!value) return '';
  let origin = String(value).trim().replace(/\/$/, '');
  origin = origin
    .replace(/^https\/\//i, 'https://')
    .replace(/^http\/\//i, 'http://');
  return origin;
};

const isValidOrigin = (origin) => {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const parseOrigins = (...sources) => {
  const origins = new Set();
  for (const source of sources) {
    if (!source) continue;
    for (const part of String(source).split(',')) {
      const normalized = normalizeOrigin(part);
      if (normalized && normalized !== '*') {
        origins.add(normalized);
      }
    }
  }
  return [...origins];
};
/** Ruxsat etilgan originlar ro'yxati — /health uchun ham kerak */
const getAllowedOrigins = (isProd) => {
  const devDefaults = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  return isProd
    ? parseOrigins(process.env.ALLOWED_ORIGIN, process.env.CLIENT_URL)
    : parseOrigins(process.env.ALLOWED_ORIGIN, process.env.CLIENT_URL, ...devDefaults);
};

const getCorsOptions = (isProd) => {
  const allowedOrigins = getAllowedOrigins(isProd);

  for (const raw of [process.env.ALLOWED_ORIGIN, process.env.CLIENT_URL]) {
    if (!raw) continue;
    for (const part of String(raw).split(',')) {
      const trimmed = part.trim();
      if (trimmed && trimmed !== normalizeOrigin(trimmed)) {
        console.warn(
          `CORS: fixed origin typo "${trimmed}" → "${normalizeOrigin(trimmed)}"`
        );
      }
    }
  }

  if (isProd) {
    console.log('CORS allowed origins:', allowedOrigins.join(', '));
  }

  return {
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }
      const requestOrigin = normalizeOrigin(origin);
      const allowed = allowedOrigins.some(
        (entry) => normalizeOrigin(entry) === requestOrigin
      );
      if (allowed) {
        callback(null, true);
        return;
      }
      /**
       * MUHIM: bu yerda `new Error(...)` uzatilsa Express uni 500 ga
       * aylantiradi va brauzerda shunchaki "Failed to fetch" ko'rinadi —
       * sababini topib bo'lmaydi. Buning o'rniga so'rovni CORS sarlavhasisiz
       * o'tkazamiz; keyin `corsRejectionHandler` aniq 403 va tushuntirish
       * qaytaradi.
       */
      console.warn(
        `CORS rad etildi: "${requestOrigin}". Ruxsat etilganlar: ${allowedOrigins.join(', ') || '(bo\'sh)'}`
      );
      callback(null, false);
    },
    credentials: true,
  };
};

/**
 * CORS'dan o'tmagan so'rovga tushunarli javob.
 * `cors` middleware'dan KEYIN qo'yiladi.
 */
const corsRejectionHandler = (isProd) => (req, res, next) => {
  const origin = req.headers.origin;
  // Origin yo'q (server-server, curl) yoki ruxsat berilgan — davom etamiz
  if (!origin || res.getHeader('Access-Control-Allow-Origin')) return next();

  const allowed = getAllowedOrigins(isProd);
  return res.status(403).json({
    message: 'CORS: bu manzilga ruxsat berilmagan',
    code: 'CORS_ORIGIN_NOT_ALLOWED',
    yourOrigin: origin,
    allowedOrigins: allowed,
    hint:
      allowed.length === 0
        ? 'Serverda ALLOWED_ORIGIN yoki CLIENT_URL sozlanmagan.'
        : `Serverdagi ALLOWED_ORIGIN ga "${origin}" ni qo'shing (vergul bilan bir nechta bo'lishi mumkin).`,
  });
};

module.exports = {
  getCorsOptions,
  getAllowedOrigins,
  corsRejectionHandler,
  parseOrigins,
  normalizeOrigin,
  isValidOrigin,
};
