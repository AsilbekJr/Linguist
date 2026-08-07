import { track } from './analytics';

/**
 * Web Push obunasi (mijoz tomoni).
 *
 * MUHIM QOIDA: ruxsat HECH QACHON sahifa yuklanishida so'ralmaydi.
 * Avtomatik so'rov — foydalanuvchi tomonidan "block" bosilishining eng keng
 * tarqalgan sababi, va bir marta bloklangandan keyin uni qaytarish deyarli
 * imkonsiz. Faqat foydalanuvchi tugmani bosgandan keyin so'raymiz.
 */

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const isPushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const getPermission = () =>
  typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';

/** Shu brauzerda faol obuna bormi */
export const getExistingSubscription = async () => {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
};

/**
 * Ruxsat so'raydi va obuna bo'ladi.
 * Faqat foydalanuvchi harakatidan (tugma bosish) chaqirilishi kerak.
 *
 * @param {(sub: object) => Promise<void>} saveSubscription  serverga yozuvchi
 * @returns {Promise<'subscribed'|'denied'|'unsupported'|'error'>}
 */
export const subscribeToPush = async (publicKey, saveSubscription) => {
  if (!isPushSupported() || !publicKey) return 'unsupported';

  const permission = await Notification.requestPermission();
  track('push_permission', { result: permission });

  if (permission !== 'granted') return 'denied';

  try {
    const registration = await navigator.serviceWorker.ready;

    // Eski obuna boshqa VAPID kaliti bilan bo'lsa uni almashtirish kerak,
    // aks holda `subscribe` xato beradi
    const existing = await registration.pushManager.getSubscription();
    if (existing) await existing.unsubscribe();

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    const json = subscription.toJSON();
    await saveSubscription({ endpoint: json.endpoint, keys: json.keys });

    track('push_subscribed');
    return 'subscribed';
  } catch (error) {
    console.warn('Push obunasi muvaffaqiyatsiz:', error.message);
    return 'error';
  }
};

/** @returns {Promise<string|null>} o'chirilgan endpoint */
export const unsubscribeFromPush = async () => {
  const subscription = await getExistingSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  track('push_unsubscribed');
  return endpoint;
};
