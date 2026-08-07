/**
 * Hodisalarni yig'ish.
 *
 * Ataylab dependency'siz: PostHog'ning `/capture/` HTTP endpointi oddiy POST
 * qabul qiladi. `posthog-js` SDK'si ~50KB qo'shadi va autocapture/session
 * replay olib keladi — bular hozir kerak emas. Bizga kerak bo'lgani aniq
 * funnel: ro'yxatdan o'tish → onboarding → 1-kun → 7-kun → to'lov.
 *
 * Kalit sozlanmagan bo'lsa hech narsa yubormaydi va hech narsani buzmaydi.
 * Shuning uchun uni chaqiruvchi joylarda `if` yozish shart emas.
 */

const KEY = import.meta.env.VITE_POSTHOG_KEY;
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';
const DEBUG = import.meta.env.DEV;

const STORAGE_KEY = 'linguist_anon_id';

/** Foydalanuvchi kirmagan bo'lsa ham funnel uzilmasligi uchun barqaror ID */
const getAnonId = () => {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = `anon_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // Shaxsiy rejimda localStorage bloklanishi mumkin
    return 'anon_unavailable';
  }
};

let distinctId = null;

const isEnabled = () => Boolean(KEY);

const post = (payload) => {
  if (!isEnabled()) return;
  const body = JSON.stringify(payload);

  // sendBeacon sahifa yopilayotganda ham yetkazadi
  if (navigator.sendBeacon) {
    const ok = navigator.sendBeacon(
      `${HOST}/capture/`,
      new Blob([body], { type: 'application/json' })
    );
    if (ok) return;
  }
  fetch(`${HOST}/capture/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    // Analitika hech qachon foydalanuvchi oqimini buzmasligi kerak
  });
};

/**
 * Hodisani yozish.
 * @param {string} event  snake_case nom, masalan 'topic_day_finished'
 * @param {object} props
 */
export const track = (event, props = {}) => {
  if (DEBUG) console.debug('[analytics]', event, props);
  // Kalit yo'q bo'lsa localStorage'ga ham tegmaymiz: o'chirilgan xizmat uchun
  // foydalanuvchi qurilmasida identifikator qoldirish noto'g'ri bo'lardi
  if (!isEnabled()) return;
  post({
    api_key: KEY,
    event,
    properties: {
      distinct_id: distinctId || getAnonId(),
      $current_url: window.location.pathname, // to'liq URL emas — tokenli havolalar tushmasin
      ...props,
    },
    timestamp: new Date().toISOString(),
  });
};

/** Kirgandan keyin anonim ID'ni haqiqiy foydalanuvchiga bog'lash */
export const identify = (userId, traits = {}) => {
  if (!userId || !isEnabled()) return;
  const previous = distinctId || getAnonId();
  distinctId = String(userId);

  post({
    api_key: KEY,
    event: '$identify',
    properties: {
      distinct_id: distinctId,
      $anon_distinct_id: previous,
      $set: traits,
    },
    timestamp: new Date().toISOString(),
  });
};

export const resetIdentity = () => {
  distinctId = null;
};

/**
 * Ushlanmagan xatolar.
 * Bu funnel emas, lekin bir xil quvur orqali ketgani ma'qul — alohida
 * xizmat qo'shishdan oldin kamida xatolar ko'rinadigan bo'lsin.
 */
export const trackError = (error, context = {}) => {
  track('client_error', {
    message: String(error?.message || error).slice(0, 300),
    stack: String(error?.stack || '').slice(0, 1000),
    ...context,
  });
};

/** Funnel nomlari bir joyda — terish xatosi tahlilni jimgina buzmasin */
export const EVENTS = {
  REGISTERED: 'registered',
  LOGGED_IN: 'logged_in',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  TOPIC_DAY_STARTED: 'topic_day_started',
  TOPIC_QUIZ_PASSED: 'topic_quiz_passed',
  TOPIC_DAY_FINISHED: 'topic_day_finished',
  REVIEW_SESSION_FINISHED: 'review_session_finished',
  LISTENING_FINISHED: 'listening_finished',
  PRACTICE_FINISHED: 'practice_finished',
  DAILY_PLAN_COMPLETED: 'daily_plan_completed',
  AI_UNAVAILABLE: 'ai_unavailable',
  QUOTA_EXCEEDED: 'quota_exceeded',
  UPGRADE_CLICKED: 'upgrade_clicked',
};

export const analyticsEnabled = isEnabled;
