const API_URL = import.meta.env.VITE_API_URL || '';

export const getApiErrorMessage = (err, fallback = "So'rovda xatolik yuz berdi.") => {
  const status = err?.status;
  const data = err?.data || {};
  const msg = data.error || data.message;

  /**
   * Tarmoq xatosi. Brauzer CORS'da bloklangan javobni JS'ga umuman
   * ko'rsatmaydi — biz faqat "Failed to fetch" ni ko'ramiz. Shuning uchun
   * eng ehtimoliy sabablarni o'zimiz aytamiz, aks holda foydalanuvchi ham,
   * dasturchi ham nima bo'lganini bilmaydi.
   */
  if (status === 'FETCH_ERROR' || err?.name === 'TypeError') {
    return (
      `Serverga ulanib bo'lmadi (${API_URL || 'API manzili sozlanmagan'}). ` +
      'Sabablari: server uxlab qolgan (Render bepul tarifi — 30-50 soniya kuting), ' +
      "yoki serverdagi ALLOWED_ORIGIN ro'yxatida shu sayt manzili yo'q. " +
      "Brauzer konsolida CORS xatosi bor-yo'qligini tekshiring."
    );
  }
  if (status === 'PARSING_ERROR') {
    return "Serverdan kutilmagan javob keldi. VITE_API_URL to'g'ri backendga ishora qilyaptimi?";
  }

  if (status === 403 && data.code === 'CORS_ORIGIN_NOT_ALLOWED') {
    return (
      `Bu manzilga ruxsat berilmagan (${data.yourOrigin}). ` +
      `Serverdagi ALLOWED_ORIGIN ga uni qo'shing.`
    );
  }
  if (status === 429 && data.code === 'RATE_LIMITED') {
    return msg || "Juda ko'p urinish. 15 daqiqadan keyin qayta urinib ko'ring.";
  }

  if (status === 401) {
    return "Sessiya tugagan. Chiqib, qayta login qiling.";
  }
  if (status === 402 || data.code === 'AI_QUOTA_EXCEEDED') {
    return msg || "Kunlik AI limiti tugadi. Ertaga yoki Pro tarif.";
  }
  if (status === 429) {
    if (data.code === 'GEMINI_RATE_LIMIT') {
      return 'Google AI limiti tugadi (bepul ~20/kun). 30 daqiqa kuting yoki GEMINI_MODEL=gemini-2.0-flash qo\'ying.';
    }
    return msg || "AI band. Bir necha daqiqadan keyin qayta urinib ko'ring.";
  }
  if (status === 503 && data.code === 'GEMINI_NOT_CONFIGURED') {
    return "Serverda AI kaliti yo'q (GEMINI_API_KEY).";
  }
  if (status === 503) {
    return msg || 'AI xizmati vaqtincha ishlamayapti.';
  }

  return msg || fallback;
};
