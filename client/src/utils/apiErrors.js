export const getApiErrorMessage = (err, fallback = "So'rovda xatolik yuz berdi.") => {
  const status = err?.status;
  const data = err?.data || {};
  const msg = data.error || data.message;

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
