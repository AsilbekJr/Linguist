/* eslint-env serviceworker */
/**
 * Service worker.
 *
 * Uchta qat'iy qoida:
 *
 * 1. API JAVOBLARI HECH QACHON KESHLANMAYDI.
 *    Ular foydalanuvchi ma'lumotini o'z ichiga oladi. Umumiy qurilmada
 *    keshlangan javob boshqa hisobga ko'rinib qolishi mumkin, bundan tashqari
 *    eskirgan progress ko'rsatish SRS jadvalini chalkashtiradi.
 *
 * 2. Navigatsiya — avval tarmoq, keyin kesh.
 *    Foydalanuvchi doim eng yangi versiyani oladi; internet yo'q bo'lsagina
 *    keshdagi app shell ko'rsatiladi.
 *
 * 3. Statik fayllar (assets/) — kontent-xesh bilan nomlangani uchun
 *    o'zgarmaydi, ularni bemalol uzoq keshlash mumkin.
 */

const VERSION = 'v1';
const SHELL_CACHE = `linguist-shell-${VERSION}`;
const ASSET_CACHE = `linguist-assets-${VERSION}`;

/** Oflaynda ham ochilishi kerak bo'lgan minimal to'plam */
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // Bitta fayl yuklanmasa butun o'rnatish yiqilmasin
      .then((cache) => Promise.allSettled(SHELL_FILES.map((f) => cache.add(f))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('linguist-') && k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Yangi versiya tayyor bo'lganda sahifa so'rasa darhol almashamiz */
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

const isApiRequest = (url) =>
  url.pathname.startsWith('/api/') || url.pathname === '/health';

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Faqat GET keshlanadi
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1-qoida: API — hech qachon keshlanmaydi va kesh orqali javob berilmaydi
  if (isApiRequest(url) || url.origin !== self.location.origin) return;

  // 2-qoida: navigatsiya — network-first, oflaynda app shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE);
          return (
            (await cache.match('/index.html')) ||
            (await cache.match('/')) ||
            new Response(
              '<!doctype html><meta charset="utf-8"><title>Oflayn</title>' +
                '<div style="font-family:system-ui;text-align:center;padding:48px">' +
                '<h1>Internet yo\'q</h1><p>Ulanishni tekshirib, sahifani yangilang.</p></div>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            )
          );
        })
    );
    return;
  }

  // 3-qoida: statik fayllar — stale-while-revalidate
  event.respondWith(
    caches.open(ASSET_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
