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

/**
 * Serverni oldindan uyg'otish.
 *
 * Render bepul tarifida server 15 daqiqa jimlikdan keyin uxlaydi va birinchi
 * so'rov ~20-50 soniya kutadi. Ilova yuklanishi bilan (bosh sahifa yoki login
 * ochilgan zahoti) `/health` ga javobini kutmaydigan so'rov yuboramiz: odam
 * matnni o'qiyotgan yoki parol yozayotgan paytda server uyg'onib ulguradi.
 * Bundan tashqari DNS va TLS ulanishi oldindan o'rnatiladi — keyingi API
 * so'rovlari o'sha ulanishdan foydalanadi.
 */
export const warmUpServer = () => {
  if (!API_URL) return;
  try {
    // credentials — API so'rovlari bilan bir xil: brauzer shunda o'sha ulanishni qayta ishlatadi
    fetch(`${API_URL}/health`, { mode: 'no-cors', cache: 'no-store', credentials: 'include' }).catch(() => {});
  } catch {
    // eski brauzer — muhim emas
  }
};
