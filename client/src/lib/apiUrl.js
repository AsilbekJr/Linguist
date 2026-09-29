/**
 * Backend manzili — bitta joyda.
 *
 *  - `VITE_API_URL` yozilgan bo'lsa — o'sha (Vercel'da majburiy).
 *  - Ishlab chiqishda yozilmagan bo'lsa — bo'sh satr: so'rovlar sahifaning
 *    o'z manziliga (`/api/...`) ketadi, Vite esa ularni lokal backendga
 *    uzatadi (vite.config.js → server.proxy). Ilgari zaxira qiymat
 *    `http://127.0.0.1:5000` edi: telefonda `http://192.168.x.x:5173` ochilganda
 *    127.0.0.1 TELEFONNING O'ZI bo'lib chiqardi va hech bir so'rov ishlamasdi.
 *  - Production build'da yozilmagan bo'lsa — bo'sh, va bu xato (pastda).
 */
export const API_URL = import.meta.env.VITE_API_URL || '';

/** Production build'da manzil yo'q — hech qanday so'rov ishlamaydi */
export const API_URL_MISSING = import.meta.env.PROD && !import.meta.env.VITE_API_URL;
