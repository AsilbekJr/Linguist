import { useCallback, useEffect, useRef, useState } from 'react';

/** Brauzer qo'llaydigan format (iOS Safari — mp4, qolganlari — webm) */
const pickMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return candidates.find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
};

export const recorderSupported = () =>
  typeof window !== 'undefined' &&
  typeof MediaRecorder !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia);

/**
 * Mikrofondan audio yozish (Ovoz kundaligi uchun).
 *
 * Nutqni tanish (useSpeechInput) bilan BIR VAQTDA ishlatilmaydi: Android
 * Chrome'da ikkalasi bir mikrofonni talashib, tanish to'xtab qolardi.
 * `maxSeconds` o'tgach o'zi to'xtaydi.
 */
export const useRecorder = ({ maxSeconds = 30 } = {}) => {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { blob, url, mimeType, durationMs }
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedRef = useRef(0);
  const timerRef = useRef(null);

  const cleanupStream = () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const stop = useCallback(() => {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setResult((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data?.size) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const durationMs = Date.now() - startedRef.current;
        const type = rec.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        cleanupStream();
        setRecording(false);
        setResult({ blob, url: URL.createObjectURL(blob), mimeType: type, durationMs });
      };
      recRef.current = rec;
      startedRef.current = Date.now();
      setElapsed(0);
      rec.start();
      setRecording(true);
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedRef.current) / 1000);
        setElapsed(s);
        if (s >= maxSeconds) stop();
      }, 250);
    } catch (e) {
      cleanupStream();
      setRecording(false);
      setError(e?.name === 'NotAllowedError' ? 'Mikrofonga ruxsat berilmadi.' : "Mikrofonni yoqib bo'lmadi.");
    }
  }, [maxSeconds, stop]);

  const reset = useCallback(() => {
    setResult((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    setElapsed(0);
  }, []);

  // Sahifadan chiqilsa — mikrofon o'chsin
  useEffect(
    () => () => {
      if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop();
      cleanupStream();
    },
    []
  );

  return { supported: recorderSupported(), recording, elapsed, error, result, start, stop, reset };
};

export default useRecorder;
