/**
 * Telegram webhook'ni o'rnatish va bot buyruqlarini ro'yxatdan o'tkazish.
 *
 *   npm run telegram:webhook -- https://linguist-backend.onrender.com
 *
 * Kerakli env: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET.
 * Deploydan keyin BIR MARTA ishga tushiriladi (backend manzili o'zgarsa — qayta).
 */
require('dotenv').config();
const { callApi } = require('../services/telegramService');
const { COMMANDS } = require('../services/telegramBot');

const main = async () => {
  const base = (process.argv[2] || process.env.SERVER_PUBLIC_URL || '').replace(/\/$/, '');
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN yozilmagan');
  if (!process.env.TELEGRAM_WEBHOOK_SECRET) throw new Error('TELEGRAM_WEBHOOK_SECRET yozilmagan');
  if (!/^https:\/\//.test(base)) {
    throw new Error("Backend manzili https bo'lishi kerak: npm run telegram:webhook -- https://<backend>");
  }

  const hook = await callApi('setWebhook', {
    url: `${base}/api/telegram/webhook`,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ['message', 'my_chat_member'],
    drop_pending_updates: true,
  });
  if (!hook.ok) throw new Error(`setWebhook: ${hook.description}`);
  console.log(`Webhook o'rnatildi: ${base}/api/telegram/webhook`);

  const cmds = await callApi('setMyCommands', { commands: COMMANDS });
  if (!cmds.ok) throw new Error(`setMyCommands: ${cmds.description}`);
  console.log('Bot buyruqlari yangilandi:', COMMANDS.map((c) => `/${c.command}`).join(', '));
};

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
