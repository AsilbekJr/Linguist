/** A calendar day in the learner's zone, rather than the server or device zone. */
export const dayKeyInZone = (timezone, date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

/** Find the next local midnight, including 23/25-hour daylight-saving days. */
export const millisecondsUntilNextDay = (timezone, date) => {
  const today = dayKeyInZone(timezone, date);
  const start = date.getTime();
  let low = 1;
  let high = 27 * 60 * 60 * 1000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (dayKeyInZone(timezone, new Date(start + middle)) === today) low = middle + 1;
    else high = middle;
  }
  return low;
};

/** Check on mount, midnight and return from a sleeping/background tab. */
export const watchDayChange = ({ timezone, today, refresh, now = () => new Date(),
  schedule = setTimeout, cancel = clearTimeout, target = globalThis.document }) => {
  let lastDay = today;
  let timer;
  const check = () => {
    const day = dayKeyInZone(timezone, now());
    if (day !== lastDay) {
      lastDay = day;
      refresh();
    }
  };
  const arm = () => {
    if (timer !== undefined) cancel(timer);
    timer = schedule(() => { check(); arm(); }, millisecondsUntilNextDay(timezone, now()));
  };
  const onVisible = () => { check(); arm(); };
  check();
  arm();
  target?.addEventListener('visibilitychange', onVisible);
  return () => {
    cancel(timer);
    target?.removeEventListener('visibilitychange', onVisible);
  };
};
