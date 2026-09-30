/**
 * Backend manzili — bitta joyda.
 *
 *  - `VITE_API_URL` yozilmagan (tavsiya etiladi) — so'rovlar sahifaning o'z
 *    manziliga (`/api/...`) ketadi. Production'da ularni Vercel backendga
 *    uzatadi (vercel.json → rewrites), dev'da Vite (vite.config.js → proxy).
 *    Shunda refresh cookie BIRINCHI TOMON bo'ladi — Safari uni bloklamaydi.
 *  - `VITE_API_URL` yozilgan — so'rovlar to'g'ridan-to'g'ri o'sha manzilga
 *    ketadi. Cookie uchinchi tomon bo'lib qoladi: faqat vaqtinchalik holat.
 *
 * Ilgari dev'dagi zaxira qiymat `http://127.0.0.1:5000` edi: telefonda
 * `http://192.168.x.x:5173` ochilganda 127.0.0.1 TELEFONNING O'ZI bo'lib
 * chiqardi va hech bir so'rov ishlamasdi.
 */
export const API_URL = import.meta.env.VITE_API_URL || '';

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
  // Dev'da Vite faqat /api ni uzatadi — /health so'rovi ma'nosiz
  if (!API_URL && !import.meta.env.PROD) return;
  try {
    // credentials — API so'rovlari bilan bir xil: brauzer shunda o'sha ulanishni qayta ishlatadi
    fetch(`${API_URL}/health`, { mode: 'no-cors', cache: 'no-store', credentials: 'include' }).catch(() => {});
  } catch {
    // eski brauzer — muhim emas
  }
};
