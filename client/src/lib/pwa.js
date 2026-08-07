import { track } from './analytics';

/**
 * Service worker'ni ro'yxatdan o'tkazish va o'rnatish taklifini boshqarish.
 *
 * Faqat productionda: ishlab chiqish paytida SW eski fayllarni keshlab,
 * "nega o'zgarish ko'rinmayapti?" degan chalkashlikni keltirib chiqaradi.
 */

let deferredPrompt = null;
const listeners = new Set();

const notify = () => {
  for (const fn of listeners) fn(Boolean(deferredPrompt));
};

/** O'rnatish taklifi mavjudligiga obuna bo'lish */
export const onInstallAvailable = (fn) => {
  listeners.add(fn);
  fn(Boolean(deferredPrompt));
  return () => listeners.delete(fn);
};

/** Ilova allaqachon o'rnatilgan holda ochilganmi */
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

/** @returns {Promise<'accepted'|'dismissed'|'unavailable'>} */
export const promptInstall = async () => {
  if (!deferredPrompt) return 'unavailable';
  const prompt = deferredPrompt;
  deferredPrompt = null;
  notify();

  prompt.prompt();
  const { outcome } = await prompt.userChoice;
  track('pwa_install_prompt', { outcome });
  return outcome;
};

export const initPwa = () => {
  // Brauzer o'rnatish mumkinligini aniqlaganda taklifni ushlab qolamiz,
  // shunda uni o'zimiz tanlagan paytda ko'rsata olamiz
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
    track('pwa_installed');
  });

  if (isStandalone()) {
    track('pwa_launched');
  }

  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        // Yangi versiya kelganda darhol almashtiramiz — foydalanuvchi
        // eski kod bilan qolib ketmasin
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              installing.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch((err) => console.warn('SW ro\'yxatdan o\'tmadi:', err.message));

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
};
