import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'motion/react';
import {
  Mic, MicOff, Send, Loader2, CheckCircle2, XCircle, ArrowRight,
  ScanText, Sparkles, AlertTriangle, WifiOff, CalendarClock, Volume2, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd, ProgressBar } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { useCheckReviewMutation, useAnalyzeSentenceMutation } from '../../features/api/apiSlice';
import { useSpeechInput } from '../../hooks/useSpeechInput';
import { playTTSAudio } from '../../utils/audio';
import { burstAt } from '../../utils/celebration';
import SentenceBreakdown from '../SentenceBreakdown';

/** Serverdagi MAX_STAGE bilan bir xil (utils/srs.js) */
const MAX_STAGE = 7;
const EASE = [0.16, 1, 0.3, 1];

/** Server javobidan "qachon qaytadi" matni */
const nextReviewLabel = (result) => {
  if (!result || result.practice) return null;
  if (result.learned) return "So'z yodlandi — navbatga boshqa tushmaydi";
  const days = Number(result.intervalDays);
  if (!days) return null;
  return days === 1 ? 'Ertaga yana chiqadi' : `${days} kundan keyin yana chiqadi`;
};

/** AI tekshirmagan bo'lsa — nega (foydalanuvchi grammatikasi tekshirilmaganini bilishi kerak) */
const localCheckNote = (result) =>
  result.aiReason === 'QUOTA'
    ? "Bugungi AI limiti tugadi — faqat so'z ishlatilgani tekshirildi, grammatika emas."
    : "AI hozir ishlamayapti — faqat so'z ishlatilgani tekshirildi, grammatika emas.";

/** 7 bosqich — nuqtalar bilan: qancha yo'l bosilgani bir qarashda ko'rinadi */
const StageDots = ({ stage }) => (
  <div className="flex items-center gap-1" aria-label={`Bosqich ${stage} / ${MAX_STAGE}`} title={`Bosqich ${stage} / ${MAX_STAGE}`}>
    {Array.from({ length: MAX_STAGE }).map((_, i) => (
      <motion.span
        key={i}
        initial={false}
        animate={{ scale: i < stage ? 1 : 0.8 }}
        className={cn(
          'h-1.5 w-3 rounded-full transition-colors duration-500',
          i < stage ? 'bg-primary' : 'bg-muted-foreground/20'
        )}
      />
    ))}
  </div>
);

/**
 * Takrorlash oqimi: so'zlar birin-ketin keladi, har biri uchun foydalanuvchi
 * shu so'z ishtirokida gap tuzadi — yozib yoki mikrofonga aytib.
 *
 * Nega tanlash emas, gap tuzish: eski oqimda foydalanuvchi o'zini o'zi
 * baholardi ("Esladim" / "Qiyin"). Bu o'lchov emas edi — bilmagan so'zga ham
 * "Esladim" bosish mumkin. Gap tuzish esa bilimni ko'rsatadi.
 */
const ReviewRunner = ({ words, onChecked, onFinished }) => {
  const [index, setIndex] = useState(0);
  const [sentence, setSentence] = useState('');
  const [result, setResult] = useState(null);
  // Tarmoq/server xatosi — bu JAVOB EMAS, shuning uchun natija kartasida
  // "noto'g'ri" deb ko'rsatilmaydi; forma va yozilgan gap joyida qoladi
  const [sendError, setSendError] = useState(null);
  // Mikrofon tanigan matn. U darhol yuborilmaydi: tanish xato qilsa, so'z
  // foydalanuvchining aybisiz 1-bosqichga tushib ketardi
  const [voiceText, setVoiceText] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);

  const [checkReview, { isLoading: isChecking }] = useCheckReviewMutation();
  const [analyzeSentence, { isLoading: isAnalyzing }] = useAnalyzeSentenceMutation();

  const inputRef = useRef(null);
  const nextRef = useRef(null);
  const resultIconRef = useRef(null);
  const shake = useAnimationControls();

  const word = words[index];
  const isLast = index >= words.length - 1;

  const submit = async () => {
    const value = sentence.trim();
    if (!value || isChecking) return;

    // Tanilgan matn tuzatilgan bo'lsa, bu endi yozma javob
    const source = voiceText && voiceText.trim() === value ? 'voice' : 'text';
    setSendError(null);
    setAnalysis(null);
    setAnalysisError(null);

    try {
      const response = await checkReview({ id: word._id, sentence: value, source }).unwrap();
      setSentence(value);
      setResult(response);
      onChecked?.(word._id, response);
    } catch (err) {
      setSendError(
        err?.data?.message || "Javobni yuborib bo'lmadi. Internetni tekshirib qayta urining."
      );
    }
  };

  const speech = useSpeechInput({
    lang: 'en-US',
    onResult: (text) => {
      setSentence(text);
      setVoiceText(text);
    },
  });

  // Yangi so'zga o'tganda hamma narsa tozalanadi va fokus inputga qaytadi
  useEffect(() => {
    setSentence('');
    setResult(null);
    setSendError(null);
    setVoiceText(null);
    setAnalysis(null);
    setAnalysisError(null);
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 250);
    return () => clearTimeout(t);
  }, [index]);

  // Tanilgan matn inputga tushdi — tekshirib tuzatish uchun fokus
  useEffect(() => {
    if (voiceText && !speech.listening) inputRef.current?.focus();
  }, [voiceText, speech.listening]);

  // Natija: to'g'ri bo'lsa kichik bayram, xato bo'lsa yengil silkinish.
  // Fokus "Keyingi" tugmasiga — Enter bilan davom etish mumkin.
  useEffect(() => {
    if (!result) return;
    nextRef.current?.focus({ preventScroll: true });
    if (result.isCorrect && !result.practice) {
      requestAnimationFrame(() => burstAt(resultIconRef.current));
    } else if (!result.isCorrect) {
      shake.start({ x: [0, -8, 8, -5, 5, 0], transition: { duration: 0.4 } });
    }
  }, [result, shake]);

  const goNext = () => {
    if (isLast) {
      onFinished?.();
      return;
    }
    setIndex((i) => i + 1);
  };

  const retry = () => {
    setResult(null);
    setAnalysis(null);
    setAnalysisError(null);
    // Gap o'chirilmaydi — foydalanuvchi uni tuzatadi
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const explain = async () => {
    setAnalysisError(null);
    try {
      const data = await analyzeSentence(sentence).unwrap();
      setAnalysis(data);
    } catch (err) {
      setAnalysisError(
        err?.data?.message || "Tahlil hozir ishlamayapti. Keyinroq urinib ko'ring."
      );
    }
  };

  if (!word) return null;

  // Javob berilgan so'z ham bajarilgan hisoblanadi — oxirgisida 100% bo'lsin
  const doneCount = index + (result ? 1 : 0);
  const stageNow = result?.stage ?? word.stage ?? 0;
  const nextLabel = nextReviewLabel(result);
  const voiceUnchanged = voiceText && voiceText === sentence;

  return (
    <div className="space-y-5">
      {/* Navbat holati */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold tabular">
          {index + 1}<span className="text-muted-foreground">/{words.length}</span>
        </span>
        <ProgressBar value={doneCount} max={words.length} className="h-2 flex-1" label="Takrorlash jarayoni" />
        <StageDots stage={stageNow} />
      </div>

      {/* So'z kartochkasi */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={word._id}
          initial={{ opacity: 0, x: 32, rotate: 1 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          exit={{ opacity: 0, x: -32, rotate: -1 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-6"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-[2rem] font-extrabold leading-none tracking-tight sm:text-4xl">{word.word}</h3>
                {word.phonetic && (
                  <span className="font-ipa text-[15px] text-muted-foreground">{word.phonetic}</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {word.partOfSpeech && (
                  <span className="rounded-full bg-card/80 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                    {word.partOfSpeech}
                  </span>
                )}
                {word.translation && <span className="text-lg font-semibold text-primary">{word.translation}</span>}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0 rounded-full"
              onClick={() => playTTSAudio(word.word, 'en-GB', 0.95)}
              aria-label="Talaffuzni eshitish"
            >
              <Volume2 />
            </Button>
          </div>

          {word.definition && <p className="mt-4 text-[15px] leading-relaxed text-foreground/80">{word.definition}</p>}
          {word.examples?.[0] && (
            <div className="mt-4 border-l-2 border-primary/40 pl-3">
              <p className="text-[15px] italic">{word.examples[0]}</p>
              {word.exampleUz && <p className="mt-0.5 text-sm text-muted-foreground">{word.exampleUz}</p>}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Javob */}
      <AnimatePresence mode="wait" initial={false}>
        {!result ? (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE }}
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="space-y-3"
          >
            <label htmlFor="review-sentence" className="text-sm font-bold">
              Shu so&apos;z ishtirokida inglizcha gap tuzing
            </label>
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-2xl border bg-card p-1.5 shadow-xs transition-[border-color,box-shadow]',
                speech.listening
                  ? 'border-destructive/50 ring-4 ring-destructive/10'
                  : 'border-input focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15'
              )}
            >
              <input
                id="review-sentence"
                ref={inputRef}
                value={speech.listening ? speech.interim : sentence}
                onChange={(e) => setSentence(e.target.value)}
                placeholder={speech.listening ? 'Eshitmoqdaman…' : `I ... ${word.word} ...`}
                disabled={isChecking || speech.listening}
                autoComplete="off"
                autoCapitalize="sentences"
                spellCheck={false}
                enterKeyHint="send"
                className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground/70 disabled:opacity-70"
              />
              {speech.supported && (
                <Button
                  type="button"
                  variant={speech.listening ? 'destructive' : 'ghost'}
                  size="icon"
                  className="relative shrink-0 rounded-xl"
                  onClick={speech.toggle}
                  disabled={isChecking}
                  aria-label={speech.listening ? "Yozishni to'xtatish" : 'Mikrofonga aytish'}
                >
                  {speech.listening && (
                    <span className="absolute inset-0 animate-ping rounded-xl bg-destructive/40" aria-hidden="true" />
                  )}
                  {speech.listening ? <MicOff /> : <Mic />}
                </Button>
              )}
              <Button
                type="submit"
                size="icon"
                className="shrink-0 rounded-xl"
                disabled={isChecking || speech.listening || !sentence.trim()}
                aria-label="Yuborish"
              >
                {isChecking ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </div>

            <AnimatePresence>
              {sendError && (
                <motion.div
                  role="alert"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm">
                    <p className="flex items-start gap-2">
                      <WifiOff className="mt-0.5 size-4 shrink-0 text-warning" />
                      <span>
                        {sendError} Gapingiz saqlanib qoldi — qayta yuborish uchun{' '}
                        <Send className="inline size-3.5" /> tugmasini bosing.
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={goNext}
                      className="text-xs font-bold text-muted-foreground underline underline-offset-2 hover:text-foreground"
                    >
                      {isLast ? 'Hozircha yakunlash' : "Bu so'zni keyinroq takrorlash"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {speech.error && <p className="text-sm text-destructive">{speech.error}</p>}
            {voiceUnchanged ? (
              <p className="text-xs font-medium text-primary">
                Mikrofon shunday tanidi. Tekshiring, kerak bo&apos;lsa tuzating va yuboring.
              </p>
            ) : speech.supported ? (
              <p className="text-xs text-muted-foreground">
                Yozib ham, mikrofonga aytib ham bo&apos;ladi. Ovozli javobda talaffuz emas,
                aytilgan gapning matni tekshiriladi.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Bu brauzer mikrofonli javobni qo&apos;llab-quvvatlamaydi — gapni yozing.
              </p>
            )}
          </motion.form>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="space-y-4"
          >
            <motion.div
              animate={shake}
              role="status"
              className={cn(
                'rounded-2xl border p-4 sm:p-5',
                result.isCorrect ? 'border-success/35 bg-success/8' : 'border-destructive/35 bg-destructive/8'
              )}
            >
              <div className="flex items-start gap-3">
                <motion.span
                  ref={resultIconRef}
                  initial={{ scale: 0.3, rotate: -40 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                  className="mt-0.5 shrink-0"
                >
                  {result.isCorrect ? (
                    <CheckCircle2 className="size-7 text-success" />
                  ) : (
                    <XCircle className="size-7 text-destructive" />
                  )}
                </motion.span>
                <div className="min-w-0 flex-grow">
                  <p className="text-lg font-extrabold">
                    {result.isCorrect ? "To'g'ri!" : "Hali to'g'ri emas"}
                  </p>
                  <p className="mt-1 break-words text-sm">
                    <span className="text-muted-foreground">Sizning gapingiz: </span>
                    <span className="italic">{sentence}</span>
                  </p>
                  <p className="mt-1.5 text-sm">{result.feedback}</p>

                  {result.corrected && result.corrected !== sentence && (
                    <p className="mt-2 rounded-xl bg-card/70 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">To&apos;g&apos;ri variant: </span>
                      <span className="font-semibold">{result.corrected}</span>
                    </p>
                  )}

                  {/* Qayta urinish jadvalga ta'sir qilmaydi — server buni mashq deb
                      hisoblaydi. Aks holda foydalanuvchi "to'g'ri" deb ko'rib,
                      bosqich oshdi deb o'ylardi. */}
                  {result.practice && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Mashq: bu so&apos;zning bugungi takrorlashi hisoblangan, bosqich o&apos;zgarmadi.
                    </p>
                  )}

                  {result.learned && !result.practice ? (
                    <p className="mt-2 flex items-center gap-1 text-sm font-bold text-success">
                      <Sparkles className="size-4" />
                      Bu so&apos;z yodlangan so&apos;zlarga o&apos;tdi!
                    </p>
                  ) : (
                    nextLabel && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <CalendarClock className="size-3.5 shrink-0" />
                        {nextLabel}
                      </p>
                    )
                  )}

                  {result.method === 'local' && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      {localCheckNote(result)}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Gap tahlili — o'z gapini bo'laklarga ajratib ko'rish */}
            {result.method === 'ai' && !analysis && (
              <Button type="button" variant="soft" onClick={explain} disabled={isAnalyzing} className="w-full">
                {isAnalyzing ? (
                  <>
                    <Loader2 className="animate-spin" /> Tahlil qilinmoqda…
                  </>
                ) : (
                  <>
                    <ScanText /> Gapimni tushuntir
                  </>
                )}
              </Button>
            )}
            {analysisError && <p className="text-sm text-destructive">{analysisError}</p>}
            <AnimatePresence>
              {analysis && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="overflow-hidden"
                >
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <SentenceBreakdown analysis={analysis} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-2">
              {!result.isCorrect && (
                <Button type="button" variant="outline" size="lg" className="flex-1" onClick={retry}>
                  <RotateCcw /> Tuzatib ko&apos;rish
                </Button>
              )}
              <Button ref={nextRef} type="button" size="lg" className="flex-1" onClick={goNext}>
                {isLast ? 'Yakunlash' : "Keyingi so'z"}
                <ArrowRight />
              </Button>
            </div>
            <p className="hidden text-center text-[11px] text-muted-foreground sm:block">
              Davom etish uchun <Kbd>Enter</Kbd>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReviewRunner;
