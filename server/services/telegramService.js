const crypto = require('crypto');

/**
 * Telegram Bot API.
 *
 * SDK ishlatilmaydi — bizga uchta metod kerak (sendMessage, setWebhook,
 * setMyCommands), ular oddiy HTTPS so'rov. Token yo'q bo'lsa modul o'chiq
 * holatda qoladi va eslatmalar push/email orqali ketaveradi.
 */

const token = () => process.env.TELEGRAM_BOT_TOKEN || '';
const botUsername = () => (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '');

const isTelegramConfigured = () => Boolean(token() && botUsername());

/** Testlarda haqiqiy api.telegram.org ga chiqmaslik uchun almashtiriladi */
let transport = (url, init) => fetch(url, init);
const _setTransport = (fn) => {
  transport = fn || ((url, init) => fetch(url, init));
};

/**
 * Bot API chaqiruvi.
 * @returns {Promise<{ok: boolean, status?: number, description?: string, result?: any}>}
 */
const callApi = async (method, payload) => {
  if (!token()) return { ok: false, description: 'not_configured' };
  try {
    const res = await transport(`https://api.telegram.org/bot${token()}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: Boolean(data.ok), status: res.status, description: data.description, result: data.result };
  } catch (error) {
    return { ok: false, description: error.message };
  }
};

/** HTML parse_mode uchun — foydalanuvchi ismi kabi matnlar belgilarni buzmasin */
const escapeHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Xabar yuborish.
 * `buttonUrl` — Telegram faqat https havolani tugma sifatida qabul qiladi,
 * lokal `http://localhost` bilan butun xabar rad etilardi. Shuning uchun
 * https bo'lmasa tugma qo'shilmaydi.
 *
 * @returns {Promise<{ok: boolean, blocked?: boolean, description?: string}>}
 */
const sendMessage = async (chatId, text, { buttonText, buttonUrl } = {}) => {
  const payload = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };
  if (buttonText && /^https:\/\//.test(buttonUrl || '')) {
    payload.reply_markup = { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] };
  }
  const res = await callApi('sendMessage', payload);
  // 403 — foydalanuvchi botni bloklagan yoki chatni o'chirgan. Bu doimiy
  // holat: bog'lanishni uzish kerak, aks holda har kuni xatoga uriladi.
  const blocked = !res.ok && (res.status === 403 || /chat not found/i.test(res.description || ''));
  return { ok: res.ok, blocked, description: res.description };
};

/** Bir martalik bog'lash kodi. Bazada faqat hash saqlanadi. */
const LINK_CODE_TTL_MS = 15 * 60 * 1000;
const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');
const createLinkCode = () => {
  // Telegram /start parametri: faqat [A-Za-z0-9_-], 64 belgigacha
  const code = crypto.randomBytes(18).toString('base64url');
  return { code, hash: hashCode(code), expires: new Date(Date.now() + LINK_CODE_TTL_MS) };
};

const deepLink = (code) => `https://t.me/${botUsername()}?start=${code}`;

/** Webhook sirini doimiy vaqtda taqqoslash */
const isValidWebhookSecret = (provided) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return false;
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

module.exports = {
  isTelegramConfigured,
  botUsername,
  callApi,
  sendMessage,
  escapeHtml,
  createLinkCode,
  hashCode,
  deepLink,
  isValidWebhookSecret,
  LINK_CODE_TTL_MS,
  _setTransport,
};
