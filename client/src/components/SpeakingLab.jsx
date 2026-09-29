import React, { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Mic, MicOff, Volume2, Loader2, RefreshCw, AudioLines, Languages, Info, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { useTranslateSpeakingMutation, useEvaluateSpeakingMutation } from '../features/api/apiSlice';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { playTTSAudio } from '../utils/audio';
import { getApiErrorMessage } from '../utils/apiErrors';

const EASE = [0.16, 1, 0.3, 1];
const CACHE_KEY = 'linguist_speak_translate_cache';

const readTranslateCache = (text) => {
  try {
    const cache = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}');
    return cache[text.trim().toLowerCase()] || null;
  } catch {
    return null;
  }
};

const writeTranslateCache = (text, data) => {
  try {
    const cache = JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}');
    cache[text.trim().toLowerCase()] = data;
    const keys = Object.keys(cache);
    if (keys.length > 40) delete cache[keys[0]];
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* shaxsiy rejim — kesh shart emas */
  }
};

const VARIANTS = [
  { key: 'casual', label: 'Sodda', hint: 'Kundalik suhbat uchun', tone: 'info' },
  { key: 'advanced', label: 'Murakkab', hint: 'Boyroq lug\'at bilan', tone: 'primary' },
];

const scoreTone = (score) => (score >= 85 ? 'success' : score >= 55 ? 'warning' : 'destructive');

/**
 * Gapirish mashqi: o'zbekcha fikr → ikki xil inglizcha variant → o'zi aytib ko'rish.
 *
 * Ilgari: brauzerda SpeechRecognition bo'lmasa (Firefox, ko'p iOS) tugma
 * `null.start()` chaqirib sahifani qulatardi, `uz-UZ` tanish esa deyarli hech
 * qayerda ishlamaydi — va matn kiritish imkoni yo'q edi. Endi o'zbekcha gapni
 * yozish ham mumkin; mikrofon — qo'shimcha qulaylik.
 *
 * Baho TALAFFUZ emas: brauzer tanigan matn maqsadli gap bilan solishtiriladi.
 * UI buni ochiq aytadi.
 */
const SpeakingLab = () => {
  const [uzbekText, setUzbekText] = useState('');
  const [translations, setTranslations] = useState(null);
  const [practiceType, setPracticeType] = useState(null);
  const [spokenEnglish, setSpokenEnglish] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [error, setError] = useState('');

  const [translateSpeaking, { isLoading: isTranslating }] = useTranslateSpeakingMutation();
  const [evaluateSpeaking, { isLoading: isEvaluating }] = useEvaluateSpeakingMutation();

  const translate = useCallback(
    async (raw) => {
      const text = String(raw || '').trim();
      if (text.length < 3) {
        setError("Kamida bir nechta so'zdan iborat gap yozing.");
        return;
      }
      setError('');
      setEvaluation(null);
      setSpokenEnglish('');
      setPracticeType(null);

      const cached = readTranslateCache(text);
      if (cached) {
        setTranslations(cached);
        return;
      }
      try {
        const data = await translateSpeaking(text).unwrap();
        writeTranslateCache(text, data);
        setTranslations(data);
      } catch (err) {
        setError(getApiErrorMessage(err, 'Tarjima qilishda xatolik yuz berdi.'));
      }
    },
    [translateSpeaking]
  );

  // O'zbekcha: tanilgan matn maydonga tushadi — foydalanuvchi tuzatib, keyin tarjima qiladi
  const uzSpeech = useSpeechInput({
    lang: 'uz-UZ',
    onResult: (text) => setUzbekText(text),
  });

  const evaluate = async (spoken, type) => {
    const target = translations?.[type];
    if (!target || spoken.trim().length < 2) return;
    try {
      const data = await evaluateSpeaking({ targetSentence: target, spokenText: spoken }).unwrap();
      setEvaluation(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Javobni tekshirib bo'lmadi."));
    }
  };

  const enSpeech = useSpeechInput({
    lang: 'en-US',
    onResult: (text) => {
      setSpokenEnglish(text);
      evaluate(text, practiceType);
    },
  });

  const startPractice = (type) => {
    if (enSpeech.listening) {
      enSpeech.stop();
      return;
    }
    setPracticeType(type);
    setSpokenEnglish('');
    setEvaluation(null);
    setError('');
    enSpeech.start();
  };

  const reset = () => {
    setUzbekText('');
    setTranslations(null);
    setSpokenEnglish('');
    setEvaluation(null);
    setPracticeType(null);
    setError('');
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Gapirish"
        title="Fikringizni inglizcha ayting"
        tone="pink"
        icon={AudioLines}
        description="O'zbekcha gap yozing yoki ayting — ikki xil inglizcha variantini ko'rsatamiz. Keyin uni o'zingiz aytib ko'rasiz."
      />

      {/* 1-qadam: o'zbekcha fikr */}
      <section className="surface p-5 sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
          <h2 className="font-bold">O&apos;zbekcha fikringiz</h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            translate(uzbekText);
          }}
        >
          <div className="relative">
            <Textarea
              value={uzSpeech.listening ? uzSpeech.interim : uzbekText}
              onChange={(e) => setUzbekText(e.target.value)}
              placeholder="Masalan: Ertaga do'stlarim bilan tog'ga chiqmoqchiman."
              rows={3}
              maxLength={400}
              disabled={uzSpeech.listening || isTranslating}
              className="pr-16 text-lg"
              aria-label="O'zbekcha gap"
            />
            {uzSpeech.supported && (
              <Button
                type="button"
                size="icon"
                variant={uzSpeech.listening ? 'destructive' : 'soft'}
                className="absolute bottom-3 right-3 rounded-full"
                onClick={uzSpeech.toggle}
                aria-label={uzSpeech.listening ? "To'xtatish" : "O'zbekcha aytish"}
              >
                {uzSpeech.listening && <span className="absolute inset-0 animate-ping rounded-full bg-destructive/40" />}
                {uzSpeech.listening ? <MicOff /> : <Mic />}
              </Button>
            )}
          </div>
          {uzSpeech.error && <p className="mt-2 text-sm text-destructive">{uzSpeech.error}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button type="submit" size="lg" disabled={isTranslating || uzbekText.trim().length < 3}>
              {isTranslating ? <Loader2 className="animate-spin" /> : <Languages />}
              Inglizchaga o&apos;girish
            </Button>
            {translations && (
              <Button type="button" variant="ghost" size="lg" onClick={reset}>
                <RefreshCw /> Yangi gap
              </Button>
            )}
          </div>
        </form>
      </section>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm font-medium text-destructive"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2-qadam: variantlar va aytib ko'rish */}
      <AnimatePresence>
        {translations && !isTranslating && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="mt-6"
          >
            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
              <h2 className="font-bold">Tanlang, tinglang va o&apos;zingiz ayting</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {VARIANTS.map((v, i) => {
                const active = practiceType === v.key;
                const listening = active && enSpeech.listening;
                return (
                  <motion.div
                    key={v.key}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08 * i, duration: 0.4, ease: EASE }}
                    className={cn('surface flex flex-col p-5 transition-[border-color,box-shadow]', active && 'border-primary/40 ring-4 ring-primary/10')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-1.5 font-bold text-primary">
                          <Sparkles className="size-4" /> {v.label}
                        </p>
                        <p className="text-xs text-muted-foreground">{v.hint}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        className="rounded-full"
                        onClick={() => playTTSAudio(translations[v.key], 'en-US')}
                        aria-label={`${v.label} variantni eshitish`}
                      >
                        <Volume2 />
                      </Button>
                    </div>
                    <p className="mt-4 flex-1 text-xl font-extrabold leading-snug">{translations[v.key]}</p>
                    {enSpeech.supported ? (
                      <Button
                        className="mt-5 w-full"
                        variant={listening ? 'destructive' : 'default'}
                        onClick={() => startPractice(v.key)}
                        disabled={isEvaluating}
                      >
                        {listening ? (
                          <>
                            <span className="relative flex size-2.5">
                              <span className="absolute inline-flex size-full animate-ping rounded-full bg-white/70" />
                              <span className="relative inline-flex size-2.5 rounded-full bg-white" />
                            </span>
                            Eshitmoqdaman — to&apos;xtatish
                          </>
                        ) : (
                          <>
                            <Mic /> O&apos;zim aytib ko&apos;raman
                          </>
                        )}
                      </Button>
                    ) : null}
                    {listening && enSpeech.interim && (
                      <p className="mt-3 text-sm italic text-muted-foreground">&ldquo;{enSpeech.interim}&rdquo;</p>
                    )}
                  </motion.div>
                );
              })}
            </div>
            {!enSpeech.supported && (
              <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                Bu brauzer ovozni tanimaydi — variantlarni tinglab, ovoz chiqarib takrorlang. Tekshiruv uchun Chrome yoki Edge&apos;dan foydalaning.
              </p>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* 3-qadam: natija */}
      <AnimatePresence mode="wait">
        {isEvaluating && (
          <motion.div
            key="evaluating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="surface mt-6 flex items-center justify-center gap-3 p-6 text-muted-foreground"
          >
            <Loader2 className="size-5 animate-spin" /> Aytganingiz tekshirilmoqda…
          </motion.div>
        )}
        {!isEvaluating && evaluation && spokenEnglish && (
          <motion.section
            key="result"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className={cn(
              'mt-6 rounded-3xl border p-6 sm:p-7',
              scoreTone(evaluation.score) === 'success' && 'border-success/30 bg-success/8',
              scoreTone(evaluation.score) === 'warning' && 'border-warning/35 bg-warning/10',
              scoreTone(evaluation.score) === 'destructive' && 'border-destructive/30 bg-destructive/8'
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Moslik</p>
                <p
                  className={cn(
                    'text-5xl font-extrabold tabular',
                    scoreTone(evaluation.score) === 'success' && 'text-success',
                    scoreTone(evaluation.score) === 'warning' && 'text-warning',
                    scoreTone(evaluation.score) === 'destructive' && 'text-destructive'
                  )}
                >
                  {evaluation.score}%
                </p>
              </div>
              <span className="text-4xl" aria-hidden="true">
                {evaluation.score >= 85 ? '🔥' : evaluation.score >= 55 ? '💪' : '📚'}
              </span>
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <div className="rounded-2xl bg-card/80 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Maqsadli gap</p>
                <p className="mt-1 font-semibold">{translations?.[practiceType]}</p>
              </div>
              <div className="rounded-2xl bg-card/80 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Brauzer tanigan matn</p>
                <p className="mt-1 font-semibold">&ldquo;{spokenEnglish}&rdquo;</p>
              </div>
              <p className="leading-relaxed">{evaluation.feedback}</p>
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                Bu talaffuz bahosi emas: brauzer tanigan matn maqsadli gap bilan solishtiriladi.
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SpeakingLab;
