// Dinamik import: konfetti kodi faqat birinchi bayramda yuklanadi —
// boshlang'ich bundle'ga kirmaydi
let confettiPromise = null;
const loadConfetti = () => {
  confettiPromise ||= import('canvas-confetti').then((m) => m.default);
  return confettiPromise;
};

const BRAND_COLORS = ['#7c3aed', '#a855f7', '#ec4899', '#22c55e', '#f59e0b', '#38bdf8'];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Bayram effekti: ikki yondan "otiladigan" konfetti.
 * `canvas-confetti` GPU'da chiziladi va tugagach o'zini tozalaydi.
 * Harakatni kamaytirish yoqilgan bo'lsa — hech narsa qilinmaydi.
 */
export const fireConfetti = async (durationMs = 1400) => {
  if (typeof document === 'undefined' || prefersReducedMotion()) return;
  const confetti = await loadConfetti();

  const end = Date.now() + durationMs;
  const defaults = { startVelocity: 42, spread: 70, ticks: 220, zIndex: 9999, colors: BRAND_COLORS, scalar: 0.95 };

  (function frame() {
    confetti({ ...defaults, particleCount: 5, angle: 60, origin: { x: 0, y: 0.75 } });
    confetti({ ...defaults, particleCount: 5, angle: 120, origin: { x: 1, y: 0.75 } });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
};

/** Kichik "portlash" — bitta to'g'ri javob uchun */
export const burstAt = async (element) => {
  if (!element || prefersReducedMotion()) return;
  const confetti = await loadConfetti();
  const rect = element.getBoundingClientRect();
  confetti({
    particleCount: 36,
    spread: 60,
    startVelocity: 26,
    ticks: 120,
    scalar: 0.75,
    zIndex: 9999,
    colors: BRAND_COLORS,
    origin: {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    },
  });
};
