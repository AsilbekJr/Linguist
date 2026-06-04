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
const getCorsOptions = (isProd) => {
  const devDefaults = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const allowedOrigins = isProd
    ? parseOrigins(process.env.ALLOWED_ORIGIN, process.env.CLIENT_URL)
    : parseOrigins(
        process.env.ALLOWED_ORIGIN,
        process.env.CLIENT_URL,
        ...devDefaults
      );

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
      callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
  };
};

module.exports = {
  getCorsOptions,
  parseOrigins,
  normalizeOrigin,
  isValidOrigin,
};
