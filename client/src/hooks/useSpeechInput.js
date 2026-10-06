import { useCallback, useEffect, useRef, useState } from 'react';
import { stopTTSAudio } from '../utils/audio';

/**
 * Mikrofondan inglizcha gap olish.
 *
 * MUHIM: bu TALAFFUZNI BAHOLAMAYDI. Brauzerning `SpeechRecognition`i nutqni
 * matnga aylantiradi, biz esa o'sha matnni tekshiramiz. Ya'ni yomon talaffuz
 * bilan aytilgan, lekin to'g'ri tanilgan gap ham o'tadi. UI bu yerda "talaffuz
 * bahosi" deb yozmasligi kerak.
 *
 * Qo'llab-quvvatlanmagan brauzerlarda (Firefox, ba'zi Android WebView'lar)
 * `supported: false` qaytadi va chaqiruvchi mikrofon tugmasini umuman
 * ko'rsatmasligi kerak — bosilib ishlamaydigan tugma eng yomon variant.
 */
const getRecognitionCtor = () =>
  typeof window === 'undefined'
    ? null
    : window.SpeechRecognition || window.webkitSpeechRecognition || null;

export const useSpeechInput = ({ lang = 'en-US', onResult } = {}) => {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const finalRef = useRef('');
  const activeRef = useRef(false);
  // onResult har renderda yangi funksiya bo'ladi — effekt uni qayta
  // o'rnatmasligi uchun ref orqali o'qiymiz
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const supported = Boolean(getRecognitionCtor());

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return undefined;

    const recognition = new Ctor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event) => {
      if (!activeRef.current) return;
      let final = '';
      let partial = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else partial += event.results[i][0].transcript;
      }
      if (final) finalRef.current = final;
      setInterim(final || partial);
    };

    recognition.onerror = (event) => {
      if (!activeRef.current) return;
      finalRef.current = '';
      if (event.error === 'aborted') return;
      setListening(false);
      setError(
        event.error === 'not-allowed'
          ? 'Mikrofonga ruxsat berilmadi. Brauzer sozlamalaridan ruxsat bering.'
          : "Mikrofon bilan xatolik. Qayta urinib ko'ring yoki yozib javob bering."
      );
    };

    recognition.onend = () => {
      activeRef.current = false;
      setListening(false);
      const text = finalRef.current.trim();
      finalRef.current = '';
      setInterim('');
      if (text) onResultRef.current?.(text);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // allaqachon to'xtagan — muhim emas
      }
      recognitionRef.current = null;
      activeRef.current = false;
      finalRef.current = '';
    };
  }, [lang]);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || activeRef.current) return;
    stopTTSAudio();
    setError(null);
    setInterim('');
    finalRef.current = '';
    try {
      activeRef.current = true;
      recognition.start();
      setListening(true);
    } catch {
      activeRef.current = false;
      setListening(false);
      setError("Mikrofonni yoqib bo'lmadi. Qayta urinib ko'ring yoki yozib javob bering.");
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // muhim emas
    }
  }, []);

  const cancel = useCallback(() => {
    activeRef.current = false;
    finalRef.current = '';
    setListening(false);
    setInterim('');
    setError(null);
    try { recognitionRef.current?.abort(); } catch { /* Already stopped. */ }
  }, []);

  const toggle = useCallback(() => (activeRef.current ? stop() : start()), [start, stop]);

  return { supported, listening, interim, error, start, stop, cancel, toggle };
};

export default useSpeechInput;
