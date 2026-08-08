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
/**
 * Preview originlari uchun shablon (ixtiyoriy).
 *
 * Muammo: Vercel har bir branch uchun alohida URL beradi va uni har safar
 * qo'lda `ALLOWED_ORIGIN` ga qo'shish kerak bo'ladi. Unutilsa — CORS xatosi,
 * sababi esa brauzerda "Failed to fetch" bo'lib ko'rinadi.
 *
 * Yechim: `ALLOWED_ORIGIN_PATTERN` — operator o'zi yozadigan ANIQ regex.
 *
 * XAVFSIZLIK: bu cookie bilan ishlaydigan CORS bo'lgani uchun juda ehtiyot
 * bo'lish kerak. Shuning uchun shablon quyidagi shartlarni bajarishi shart,
 * aks holda umuman qo'llanilmaydi:
 *   - ^ va $ bilan bog'langan bo'lishi;
 *   - `https://` bilan boshlanishi;
 *   - ixtiyoriy manzilni (masalan https://evil.com) mos deb topmasligi.
 */
const compileOriginPattern = (raw) => {
  if (!raw || !String(raw).trim()) return null;
  const source = String(raw).trim();

  if (!source.startsWith('^') || !source.endsWith('$')) {
    console.error(
      `ALLOWED_ORIGIN_PATTERN e'tiborsiz qoldirildi: shablon ^ va $ bilan bog'lanishi shart. Berilgan: ${source}`
    );
    return null;
  }

  let regex;
  try {
    regex = new RegExp(source);
  } catch (err) {
    console.error(`ALLOWED_ORIGIN_PATTERN yaroqsiz regex: ${err.message}`);
    return null;
  }

  // Shablon haddan tashqari keng emasligini tekshiramiz
  const mustNotMatch = [
    'https://evil.example',
    'https://attacker.vercel.app',
    'http://localhost:5173',
    'https://a.b',
    'null',
  ];
  const leak = mustNotMatch.find((origin) => regex.test(origin));
  if (leak) {
    console.error(
      `ALLOWED_ORIGIN_PATTERN e'tiborsiz qoldirildi: u begona manzilga ham mos keldi ("${leak}"). Shablonni aniqroq yozing.`
    );
    return null;
  }

  console.log(`CORS preview shabloni yoqildi: ${source}`);
  return regex;
};

let cachedPattern;
let cachedPatternSource;
const getOriginPattern = () => {
  const raw = process.env.ALLOWED_ORIGIN_PATTERN;
  if (raw !== cachedPatternSource) {
    cachedPatternSource = raw;
    cachedPattern = compileOriginPattern(raw);
  }
  return cachedPattern;
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
      const inList = allowedOrigins.some(
        (entry) => normalizeOrigin(entry) === requestOrigin
      );
      const pattern = getOriginPattern();
      if (inList || (pattern && pattern.test(requestOrigin))) {
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

/** Origin ruxsat etilganmi — ro'yxat yoki shablon bo'yicha */
const isOriginAllowed = (origin, isProd) => {
  if (!origin) return true; // server-server, curl
  const normalized = normalizeOrigin(origin);
  if (getAllowedOrigins(isProd).some((e) => normalizeOrigin(e) === normalized)) return true;
  const pattern = getOriginPattern();
  return Boolean(pattern && pattern.test(normalized));
};

module.exports = {
  getCorsOptions,
  getAllowedOrigins,
  corsRejectionHandler,
  isOriginAllowed,
  compileOriginPattern,
  parseOrigins,
  normalizeOrigin,
  isValidOrigin,
};
