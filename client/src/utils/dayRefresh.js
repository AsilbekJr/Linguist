/** A calendar day in the learner's zone, rather than the server or device zone. */
export const dayKeyInZone = (timezone, date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

/** Check on mount, midnight and return from a sleeping/background tab. */
export const watchDayChange = ({ timezone, today, refresh, now = () => new Date(),
  schedule = setInterval, cancel = clearInterval, target = globalThis.document }) => {
  let lastDay = today;
  const check = () => {
    const day = dayKeyInZone(timezone, now());
    if (day !== lastDay) {
      lastDay = day;
      refresh();
    }
  };
  check();
  const timer = schedule(check, 30000);
  target?.addEventListener('visibilitychange', check);
  return () => {
    cancel(timer);
    target?.removeEventListener('visibilitychange', check);
  };
};
