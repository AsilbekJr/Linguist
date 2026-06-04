/** Lightweight confetti burst without extra dependencies */
export const fireConfetti = (durationMs = 1200) => {
  if (typeof document === 'undefined') return;

  const colors = ['#8b5cf6', '#ec4899', '#22c55e', '#f59e0b', '#3b82f6'];
  const container = document.createElement('div');
  container.setAttribute('aria-hidden', 'true');
  container.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden;';
  document.body.appendChild(container);

  const particleCount = 48;
  for (let i = 0; i < particleCount; i += 1) {
    const el = document.createElement('span');
    const size = 6 + Math.random() * 8;
    const left = Math.random() * 100;
    const delay = Math.random() * 300;
    const color = colors[i % colors.length];
    el.style.cssText = `
      position:absolute;
      top:-12px;
      left:${left}%;
      width:${size}px;
      height:${size}px;
      background:${color};
      border-radius:2px;
      opacity:0.9;
      transform:rotate(${Math.random() * 360}deg);
      animation:linguist-confetti ${0.8 + Math.random() * 0.6}s ease-out ${delay}ms forwards;
    `;
    container.appendChild(el);
  }

  if (!document.getElementById('linguist-confetti-style')) {
    const style = document.createElement('style');
    style.id = 'linguist-confetti-style';
    style.textContent = `
      @keyframes linguist-confetti {
        0% { transform: translateY(0) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  setTimeout(() => container.remove(), durationMs);
};
