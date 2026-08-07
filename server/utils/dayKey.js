/**
 * Foydalanuvchi vaqt zonasiga mos "kun" hisobi.
 *
 * Ilgari kod bo'ylab `new Date().toISOString().split('T')[0]` ishlatilgan edi — bu UTC.
 * O'zbekiston UTC+5 bo'lgani uchun foydalanuvchining "kuni" mahalliy soat 05:00 da
 * almashardi: kechqurun 23:00 da mashq qilgan odam ertangi kunga yozilib, streak uzilardi.
 */

const DEFAULT_TIMEZONE = process.env.DEFAULT_TIMEZONE || 'Asia/Tashkent';

const isValidTimeZone = (tz) => {
  if (!tz || typeof tz !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const resolveZone = (tz) => (isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE);

/** 'YYYY-MM-DD' — berilgan zonadagi kalendar kun */
const dayKey = (date = new Date(), tz) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: resolveZone(tz),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date instanceof Date ? date : new Date(date));

/** Foydalanuvchi profilidagi zonaga qarab kun kaliti */
const userDayKey = (user, date = new Date()) => dayKey(date, user?.timezone);

/** Zonaning shu paytdagi UTC'dan siljishi (ms) — DST'ni ham hisobga oladi */
const zoneOffsetMs = (date, tz) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: resolveZone(tz),
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second)
  );
  return asUtc - date.getTime();
};

/** 'YYYY-MM-DD' kunining mahalliy yarim tunidagi haqiqiy UTC nuqtasi */
const startOfDay = (key, tz) => {
  const [y, m, d] = String(key).split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const offset = zoneOffsetMs(new Date(guess), tz);
  return new Date(guess - offset);
};

/** Foydalanuvchi uchun bugungi kun boshlanishi (UTC Date) */
const startOfUserDay = (user, date = new Date()) =>
  startOfDay(userDayKey(user, date), user?.timezone);

/** 'YYYY-MM-DD' ga kun qo'shish/ayirish */
const shiftDayKey = (key, days) => {
  const [y, m, d] = String(key).split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(shifted);
};

/** keyB - keyA, kunlarda (butun son) */
const daysBetween = (keyA, keyB) => {
  const toUtc = (k) => {
    const [y, m, d] = String(k).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(keyB) - toUtc(keyA)) / 86400000);
};

/** prevKey todayKey'dan roppa-rosa 1 kun oldinmi? */
const isConsecutiveDay = (prevKey, todayKey) => daysBetween(prevKey, todayKey) === 1;

module.exports = {
  DEFAULT_TIMEZONE,
  isValidTimeZone,
  dayKey,
  userDayKey,
  startOfDay,
  startOfUserDay,
  shiftDayKey,
  daysBetween,
  isConsecutiveDay,
};
