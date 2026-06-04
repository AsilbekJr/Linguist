const { parseOrigins, isValidOrigin, normalizeOrigin } = require('./corsConfig');

const validateEnv = () => {
  const isProd = process.env.NODE_ENV === 'production';
  const missing = [];

  if (!process.env.JWT_SECRET?.trim()) {
    missing.push('JWT_SECRET');
  }

  if (isProd && !process.env.MONGO_URI?.trim()) {
    missing.push('MONGO_URI');
  }

  if (isProd) {
    const origins = parseOrigins(
      process.env.ALLOWED_ORIGIN,
      process.env.CLIENT_URL
    );
    if (origins.length === 0) {
      missing.push('ALLOWED_ORIGIN or CLIENT_URL (exact frontend URL, not *)');
    }
    for (const origin of origins) {
      if (!isValidOrigin(origin)) {
        missing.push(
          `valid ALLOWED_ORIGIN/CLIENT_URL (got "${origin}" — use https://...)`
        );
        break;
      }
    }
    for (const raw of [process.env.ALLOWED_ORIGIN, process.env.CLIENT_URL]) {
      if (!raw) continue;
      for (const part of String(raw).split(',')) {
        const trimmed = part.trim();
        if (trimmed && trimmed !== normalizeOrigin(trimmed)) {
          console.warn(
            `Env typo: "${trimmed}" should be "${normalizeOrigin(trimmed)}"`
          );
        }
      }
    }
  }

  if (missing.length === 0) {
    return;
  }

  console.error('FATAL: Missing required environment variables:');
  for (const key of missing) {
    console.error(`  - ${key}`);
  }
  if (isProd) {
    console.error(
      'Render: Dashboard → linguist-backend → Environment → Add each variable, then Manual Deploy.'
    );
  }
  process.exit(1);
};

module.exports = { validateEnv };
