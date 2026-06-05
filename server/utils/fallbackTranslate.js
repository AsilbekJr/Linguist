/**
 * Bepul zaxira tarjima — Gemini limiti yoki xato bo'lganda (token sarflanmaydi).
 * MyMemory: kuniga ~5000 belgi, API kalit shart emas.
 */
const fetchMyMemoryUzEn = async (text) => {
  const q = encodeURIComponent(String(text).slice(0, 450));
  const url = `https://api.mymemory.translated.net/get?q=${q}&langpair=uz|en`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) return null;

  const data = await res.json();
  const translated = data?.responseData?.translatedText?.trim();
  if (!translated || data?.responseStatus !== 200) return null;

  const casual = translated.charAt(0).toUpperCase() + translated.slice(1);
  const advanced = casual.endsWith('.') ? casual : `${casual}.`;

  return {
    casual,
    advanced,
    _source: 'mymemory',
  };
};

module.exports = { fetchMyMemoryUzEn };
