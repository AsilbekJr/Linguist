const { OAuth2Client } = require('google-auth-library');

/**
 * Google orqali kirish: brauzerdagi Google tugmasi bergan ID tokenni
 * tekshiradi. Tekshiruvni Google'ning rasmiy kutubxonasi qiladi: imzo
 * (Google kalitlari bilan), muddat, `iss` va — eng muhimi — `aud`:
 * token aynan BIZNING ilovamiz uchun berilganmi. Busiz boshqa saytga
 * berilgan Google tokeni bilan bizga kirib bo'lardi.
 */

let client = null;
const getClient = () => {
  if (!client) client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
  return client;
};

const isGoogleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID);

/**
 * @returns {Promise<{googleId: string, email: string, name: string} | {error: string}>}
 */
const verifyGoogleCredential = async (credential) => {
  let payload;
  try {
    const ticket = await getClient().verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch {
    return { error: 'INVALID_GOOGLE_TOKEN' };
  }

  // Tasdiqlanmagan email bilan hisob topish — boshqa odamning hisobiga
  // kirish yo'li bo'lardi
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    return { error: 'GOOGLE_EMAIL_NOT_VERIFIED' };
  }

  return {
    googleId: payload.sub,
    email: String(payload.email).trim().toLowerCase(),
    name: String(payload.name || payload.given_name || payload.email.split('@')[0]).trim().slice(0, 80),
  };
};

module.exports = { verifyGoogleCredential, isGoogleConfigured };
