const User = require('../models/User');
const Word = require('../models/Word');
const { userDayKey } = require('../utils/dayKey');
const { sendMessage, hashCode, escapeHtml, callApi } = require('./telegramService');

/**
 * Botga kelgan yangilanishlarni qayta ishlash.
 *
 * Webhook (production) ham, lokal polling ham shu funksiyani chaqiradi.
 * Bot ataylab sodda: bog'lash, bugungi holat va to'xtatish. Dars o'tish
 * ilovada — bot faqat odamni ilovaga qaytaradi.
 */

const appUrl = () => (process.env.CLIENT_URL || '').replace(/\/$/, '');
const openButton = (text = 'Ilovani ochish') => ({ buttonText: text, buttonUrl: appUrl() });

const COMMANDS = [
  { command: 'bugun', description: 'Bugungi reja va takrorlanadigan so\'zlar' },
  { command: 'stop', description: 'Eslatmalarni to\'xtatish' },
];

const formatHour = (h) => `${String(Number.isInteger(h) ? h : 19).padStart(2, '0')}:00`;

const unlinkChat = (chatId) =>
  User.updateMany(
    { 'telegram.chatId': String(chatId) },
    { $unset: { 'telegram.chatId': 1 }, $set: { 'telegram.username': '', 'telegram.linkedAt': null } }
  );

/** /start <kod> — hisobni bog'lash */
const linkAccount = async (chatId, code, from) => {
  const user = code
    ? await User.findOne({
        'telegram.linkCodeHash': hashCode(code),
        'telegram.linkCodeExpires': { $gt: new Date() },
      })
    : null;

  if (!user) {
    const text = code
      ? "Bu havola eskirgan yoki allaqachon ishlatilgan.\n\nIlovada <b>Sozlamalar → Eslatmalar → Telegram'ni ulash</b> tugmasini qayta bosing."
      : "Salom! Men Linguist eslatmalar botiman.\n\nHisobingizni ulash uchun ilovada <b>Sozlamalar → Eslatmalar → Telegram'ni ulash</b> tugmasini bosing.";
    await sendMessage(chatId, text, openButton());
    return { linked: false };
  }

  // Bitta chat — bitta hisob. Boshqa hisobga ulangan bo'lsa, u yerdan uziladi,
  // aks holda bir odamga ikki hisobdan ikki xil eslatma kelardi.
  await unlinkChat(chatId);

  user.telegram = {
    chatId: String(chatId),
    username: from?.username || '',
    linkedAt: new Date(),
    linkCodeHash: undefined,
    linkCodeExpires: null,
  };
  await user.save();

  const hour = formatHour(user.notifications?.email?.hour);
  const enabled = user.notifications?.email?.enabled !== false;
  await sendMessage(
    chatId,
    `✅ Hisob ulandi, <b>${escapeHtml(user.name)}</b>!\n\n` +
      (enabled
        ? `Reja bajarilmagan kunlari soat <b>${hour}</b> da shu yerga eslataman. Reja tugagan kunlari bezovta qilmayman.`
        : "Kunlik eslatma hozir o'chiq — uni ilovadagi sozlamalardan yoqishingiz mumkin.") +
      '\n\n/bugun — bugungi reja\n/stop — eslatmalarni to\'xtatish',
    openButton()
  );
  return { linked: true, userId: user._id };
};

/** /bugun — bugungi holat */
const todayStatus = async (chatId) => {
  const user = await User.findOne({ 'telegram.chatId': String(chatId) }).select(
    'name timezone currentStreak dailyQuests'
  );
  if (!user) {
    await sendMessage(chatId, "Hisob ulanmagan. Ilovada <b>Sozlamalar → Eslatmalar</b> bo'limidan ulang.", openButton());
    return;
  }

  const now = new Date();
  const todayKey = userDayKey(user, now);
  const quests = user.dailyQuests?.date === todayKey ? user.dailyQuests : {};
  const dueCount = await Word.countDocuments({
    user: user._id,
    $or: [{ nextReviewDate: { $lte: now } }, { nextReviewDate: null }],
  });

  const mark = (done) => (done ? '✅' : '⬜️');
  const lines = [
    `<b>Bugungi reja</b>`,
    `${mark(quests.topicCompleted)} Kunlik sahna`,
    `${mark(quests.reviewCompleted)} Takrorlash${dueCount ? ` — ${dueCount} ta so'z` : ''}`,
  ];
  if (user.currentStreak > 0) lines.push('', `🔥 Ketma-ketlik: ${user.currentStreak} kun`);
  if (quests.topicCompleted && quests.reviewCompleted) lines.push('', 'Bugun hammasi bajarildi. Barakalla!');

  await sendMessage(chatId, lines.join('\n'), openButton('Davom etish'));
};

/** /stop — bog'lanishni uzish */
const stop = async (chatId) => {
  const res = await unlinkChat(chatId);
  await sendMessage(
    chatId,
    res.modifiedCount
      ? "Eslatmalar to'xtatildi va hisob uzildi. Qayta ulash uchun ilovadagi sozlamalarga kiring."
      : 'Bu chat hech qaysi hisobga ulanmagan.'
  );
};

/**
 * @param {object} update — Telegram Update obyekti
 */
const handleUpdate = async (update) => {
  // Foydalanuvchi botni bloklasa — bog'lanishni darhol uzamiz
  const member = update?.my_chat_member;
  if (member?.chat?.type === 'private' && member.new_chat_member?.status === 'kicked') {
    await unlinkChat(member.chat.id);
    return { action: 'blocked' };
  }

  const msg = update?.message;
  if (!msg || msg.chat?.type !== 'private' || typeof msg.text !== 'string') return { action: 'ignored' };

  const chatId = msg.chat.id;
  const [rawCommand, arg] = msg.text.trim().split(/\s+/, 2);
  const command = rawCommand.toLowerCase().replace(/@.*$/, '');

  if (command === '/start') return { action: 'start', ...(await linkAccount(chatId, arg, msg.from)) };
  if (command === '/bugun' || command === '/today') {
    await todayStatus(chatId);
    return { action: 'today' };
  }
  if (command === '/stop') {
    await stop(chatId);
    return { action: 'stop' };
  }

  await sendMessage(chatId, "Buyruqlar:\n/bugun — bugungi reja\n/stop — eslatmalarni to'xtatish", openButton());
  return { action: 'help' };
};

/**
 * Lokal ishlab chiqish uchun long polling (TELEGRAM_POLLING=true).
 * Webhook tashqaridan kiriladigan https manzil talab qiladi — localhost'da
 * bu yo'q. Production'da webhook ishlatiladi (npm run telegram:webhook).
 */
let polling = false;
const startPolling = async () => {
  if (polling || process.env.TELEGRAM_POLLING !== 'true') return;
  polling = true;
  // Webhook o'rnatilgan bo'lsa getUpdates 409 qaytaradi
  await callApi('deleteWebhook', { drop_pending_updates: false });
  console.log('Telegram: lokal polling yoqildi');
  let offset = 0;
  while (polling) {
    const res = await callApi('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'my_chat_member'] });
    if (!res.ok) {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    for (const update of res.result || []) {
      offset = update.update_id + 1;
      await handleUpdate(update).catch((err) => console.error('Telegram update xatosi:', err.message));
    }
  }
};
const stopPolling = () => {
  polling = false;
};

module.exports = { handleUpdate, startPolling, stopPolling, COMMANDS, unlinkChat };
