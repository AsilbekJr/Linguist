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

// ─── Push bildirishnomalar ─────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'Linguist AI', body: event.data?.text?.() || '' };
  }

  const title = payload.title || 'Linguist AI';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    // Bir xil `tag` bilan kelgan yangi bildirishnoma eskisini ALMASHTIRADI.
    // Busiz bir necha kunlik eslatmalar to'planib, ekranni to'ldirib yuborardi.
    tag: payload.tag || 'linguist',
    renotify: false,
    data: { url: payload.url || '/' },
    lang: 'uz',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Ilova allaqachon ochiq bo'lsa yangi oyna ochmaymiz — uni fokusga olamiz
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          client.navigate?.(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});

// ─── Kesh strategiyasi ─────────────────────────────────────────────────────

const isApiRequest = (url) =>
  url.pathname.startsWith('/api/') || url.pathname === '/health';

/**
 * Javobni keshlash mumkinmi.
 *
 * `redirected` tekshiruvi muhim: Vercel'ning "Deployment Protection" (SSO)
 * yoqilgan bo'lsa, har bir so'rov `vercel.com/sso-api` ga yo'naltiriladi.
 * Bunday javobni keshlash keshni buzadi — foydalanuvchi keyinchalik ilova
 * o'rniga login sahifasining bo'lagini oladi.
 *
 * `type === 'basic'` — faqat o'z originimizdan kelgan to'liq javob.
 * Opaque javoblarning statusi ko'rinmaydi, ya'ni xatoni ham keshlab qo'yish mumkin.
 */
const isCacheable = (response) =>
  response &&
  response.ok &&
  !response.redirected &&
  response.type === 'basic';

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
          // SSO yo'naltirishini app shell sifatida keshlab qo'ymaymiz
          if (isCacheable(response)) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put('/index.html', copy));
          }
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

      if (cached) {
        // Fonda yangilaymiz, lekin javobni kutmaymiz
        fetch(request)
          .then((response) => {
            if (isCacheable(response)) cache.put(request, response.clone());
          })
          .catch(() => {});
        return cached;
      }

      try {
        const response = await fetch(request);
        if (isCacheable(response)) cache.put(request, response.clone());
        return response;
      } catch {
        /**
         * MUHIM: bu yerda har doim Response qaytishi SHART.
         *
         * Ilgari `.catch(() => cached)` yozilgan edi va kesh bo'sh bo'lganda
         * `undefined` qaytardi. `respondWith(undefined)` esa
         * "TypeError: Failed to convert value to 'Response'" beradi va
         * so'rov butunlay uziladi — brauzer hech qanday javob olmaydi.
         */
        return new Response('', {
          status: 504,
          statusText: 'Offline',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })
  );
});
