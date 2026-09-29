import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'motion/react';
import {
  Mic, MicOff, Send, Loader2, CheckCircle2, XCircle, ArrowRight, ScanText, Sparkles,
  AlertTriangle, WifiOff, CalendarClock, Volume2, RotateCcw, Eye, Brain, PenLine, Languages,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd, ProgressBar } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { useCheckReviewMutation, useAnalyzeSentenceMutation, useSaveReviewTranslationMutation } from '../../features/api/apiSlice';
import { useSpeechInput } from '../../hooks/useSpeechInput';
import { playTTSAudio } from '../../utils/audio';
import { burstAt } from '../../utils/celebration';
import SentenceBreakdown from '../SentenceBreakdown';

/** Serverdagi MAX_STAGE bilan bir xil (utils/srs.js) */
const MAX_STAGE = 7;
const EASE = [0.16, 1, 0.3, 1];

/**
 * Rejimlar — server so'z bosqichiga qarab tanlaydi (server/utils/reviewModes.js):
 *   recognize (0-1) → recall (2-3) → sentence (4+)
 * Tarjimasi yo'q so'z (AI javob bermagan) — avval `translate`: foydalanuvchi
 * o'zbekchasini yozadi, keyin so'z odatiy tartibda davom etadi.
 */
const MODE_META = {
  translate: { label: 'Tanishish', hint: "Bu so'zning o'zbekcha tarjimasini yozing", icon: Languages },
  recognize: { label: 'Tanib olish', hint: "To'g'ri tarjimani tanlang", icon: Eye },
  recall: { label: 'Eslash', hint: "Inglizcha so'zni yozing", icon: Brain },
  sentence: { label: 'Gap tuzish', hint: "Shu so'z bilan inglizcha gap tuzing", icon: PenLine },
};

/** Server javobidan "qachon qaytadi" matni */
const nextReviewLabel = (result) => {
  if (!result || result.practice) return null;
  if (result.learned) return "So'z yodlandi — navbatga boshqa tushmaydi";
  const days = Number(result.intervalDays);
  if (!days) return null;
  const when = days === 1 ? 'Ertaga yana chiqadi' : `${days} kundan keyin yana chiqadi`;
  // Topshiriq qiyinlashsa — oldindan aytib qo'yamiz
  if (result.nextMode && result.nextMode !== result.mode && MODE_META[result.nextMode]) {
    return `${when} — endi «${MODE_META[result.nextMode].label.toLowerCase()}» bilan`;
  }
  return when;
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
        className={cn('h-1.5 w-3 rounded-full transition-colors duration-500', i < stage ? 'bg-primary' : 'bg-muted-foreground/20')}
      />
    ))}
  </div>
);

const SpeakButton = ({ text }) =>
  text ? (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="shrink-0 rounded-full"
      onClick={() => playTTSAudio(text, 'en-GB', 0.95)}
      aria-label="Talaffuzni eshitish"
    >
      <Volume2 />
    </Button>
  ) : null;

/**
 * So'z kartochkasi. Javobdan OLDIN rejimga qarab qisman (javob yashiringan),
 * javobdan KEYIN to'liq (server qaytargan `reveal`) ko'rsatiladi.
 */
const WordCard = ({ item, reveal }) => {
  const mode = item.mode || 'sentence';
  const w = reveal ? { ...item, ...reveal } : item;

  // Eslash rejimi, javobdan oldin: o'zbekchasi asosiy, inglizcha so'z yashirin
  if (mode === 'recall' && !reveal) {
    return (
      <div>
        <p className="text-sm font-semibold text-muted-foreground">Inglizchasi qanday?</p>
        <p className="mt-1 text-[2rem] font-extrabold leading-tight tracking-tight text-primary sm:text-4xl">{w.translation}</p>
        {w.partOfSpeech && (
          <span className="mt-2 inline-block rounded-full bg-card/80 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground ring-1 ring-border">
            {w.partOfSpeech}
          </span>
        )}
        {w.hint?.length > 0 && (
          <p className="mt-3 font-mono text-lg tracking-[0.3em] text-muted-foreground" aria-label={`${w.hint.firstLetter} harfi bilan boshlanadi, ${w.hint.length} ta harf`}>
            {w.hint.firstLetter}
            {'_'.repeat(Math.max(0, w.hint.length - 1))}
          </p>
        )}
        {w.definition && <p className="mt-3 text-[15px] leading-relaxed text-foreground/80">{w.definition}</p>}
        {w.exampleMasked && (
          <div className="mt-3 border-l-2 border-primary/40 pl-3">
            <p className="text-[15px] italic">{w.exampleMasked}</p>
            {w.exampleUz && <p className="mt-0.5 text-sm text-muted-foreground">{w.exampleUz}</p>}
          </div>
        )}
      </div>
    );
  }

  const showTranslation = mode !== 'recognize' || reveal;
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-[2rem] font-extrabold leading-none tracking-tight sm:text-4xl">{w.word}</h3>
            {w.phonetic && <span className="font-ipa text-[15px] text-muted-foreground">{w.phonetic}</span>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {w.partOfSpeech && (
              <span className="rounded-full bg-card/80 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground ring-1 ring-border">
                {w.partOfSpeech}
              </span>
            )}
            {showTranslation && w.translation && <span className="text-lg font-semibold text-primary">{w.translation}</span>}
          </div>
        </div>
        <SpeakButton text={w.word} />
      </div>
      {showTranslation && w.definition && <p className="mt-4 text-[15px] leading-relaxed text-foreground/80">{w.definition}</p>}
      {w.examples?.[0] && (
        <div className="mt-4 border-l-2 border-primary/40 pl-3">
          <p className="text-[15px] italic">{w.examples[0]}</p>
          {showTranslation && w.exampleUz && <p className="mt-0.5 text-sm text-muted-foreground">{w.exampleUz}</p>}
        </div>
      )}
    </div>
  );
};

/** Tanib olish: 4 ta variant, 1-4 tugmalari bilan ham tanlanadi */
const RecognizeTask = ({ item, disabled, result, chosen, onChoose }) => {
  // Bo'sh variant hech qachon ko'rsatilmaydi — uni tanlash so'rovni buzardi
  const options = useMemo(() => (item.options || []).filter((o) => String(o || '').trim()), [item.options]);
  useEffect(() => {
    if (result || disabled) return undefined;
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) onChoose(options[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, result, disabled, onChoose]);

  const correct = result?.correctAnswer;
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label="Variantlar">
      {options.map((opt, i) => {
        const isCorrect = result && opt === correct;
        const isWrongPick = result && opt === chosen && !result.isCorrect;
        return (
          <motion.button
            key={opt}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i, duration: 0.3, ease: EASE }}
            disabled={disabled || Boolean(result)}
            onClick={() => onChoose(opt)}
            className={cn(
              'flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[15px] font-semibold transition-[border-color,background-color,opacity] active:scale-[0.99] disabled:cursor-default',
              isCorrect && 'border-success bg-success/10',
              isWrongPick && 'border-destructive bg-destructive/8',
              result && !isCorrect && !isWrongPick && 'opacity-50',
              !result && 'border-border bg-card hover:border-primary/40',
              !result && chosen === opt && 'border-primary bg-primary/8'
            )}
          >
            <span
              className={cn(
                'inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                isCorrect ? 'bg-success text-success-foreground' : isWrongPick ? 'bg-destructive text-white' : 'bg-muted text-muted-foreground'
              )}
            >
              {isCorrect ? <CheckCircle2 className="size-4" /> : isWrongPick ? <XCircle className="size-4" /> : i + 1}
            </span>
            {opt}
          </motion.button>
        );
      })}
    </div>
  );
};

/**
 * Takrorlash oqimi. So'z o'rganilgan sari topshiriq qiyinlashadi:
 * tanib olish → eslash → gap tuzish. Qaysi biri bo'lishini server aytadi.
 *
 * Nega "Esladim" tugmasi emas: o'z-o'zini baholash o'lchov emas — bilmagan
 * so'zga ham "Esladim" bosish mumkin. Bu yerdagi har bir topshiriq bilimni
 * haqiqatan tekshiradi.
 */
const ReviewRunner = ({ words, onChecked, onFinished }) => {
  const [index, setIndex] = useState(0);
  const [sentence, setSentence] = useState('');
  const [typed, setTyped] = useState('');
  const [chosen, setChosen] = useState(null);
  const [result, setResult] = useState(null);
  // Tarmoq/server xatosi — bu JAVOB EMAS: "noto'g'ri" deb ko'rsatilmaydi
  const [sendError, setSendError] = useState(null);
  // Mikrofon tanigan matn. Darhol yuborilmaydi: tanish xato qilsa, so'z
  // foydalanuvchining aybisiz 1-bosqichga tushib ketardi
  const [voiceText, setVoiceText] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);

  const [checkReview, { isLoading: isChecking }] = useCheckReviewMutation();
  const [saveTranslation, { isLoading: isSavingTranslation }] = useSaveReviewTranslationMutation();
  // Tarjima yozilgan so'zlar yangi topshiriq bilan almashtiriladi (id → item)
  const [replaced, setReplaced] = useState({});
  const [analyzeSentence, { isLoading: isAnalyzing }] = useAnalyzeSentenceMutation();

  const inputRef = useRef(null);
  const nextRef = useRef(null);
  const resultIconRef = useRef(null);
  const shake = useAnimationControls();

  const item = words[index] && (replaced[words[index]._id] || words[index]);
  const mode = item?.mode || 'sentence';
  const meta = MODE_META[mode] || MODE_META.sentence;
  const isLast = index >= words.length - 1;

  const send = async (payload) => {
    if (isChecking) return;
    setSendError(null);
    setAnalysis(null);
    setAnalysisError(null);
    try {
      const response = await checkReview({ id: item._id, ...payload }).unwrap();
      setResult(response);
      onChecked?.(item._id, response);
    } catch (err) {
      if (err?.data?.code === 'MODE_MISMATCH') {
        setSendError("Bu so'z uchun topshiriq o'zgargan. Sahifani yangilang.");
      } else {
        setSendError(err?.data?.message || "Javobni yuborib bo'lmadi. Internetni tekshirib qayta urining.");
      }
    }
  };

  const submitSentence = () => {
    const value = sentence.trim();
    if (!value) return;
    // Tanilgan matn tuzatilgan bo'lsa, bu endi yozma javob
    const source = voiceText && voiceText.trim() === value ? 'voice' : 'text';
    setSentence(value);
    send({ mode: 'sentence', sentence: value, source });
  };

  const submitRecall = () => {
    const value = typed.trim();
    if (value) send({ mode: 'recall', answer: value });
  };

  const submitTranslation = async () => {
    const value = typed.trim();
    if (!value || isSavingTranslation) return;
    setSendError(null);
    try {
      const res = await saveTranslation({ id: item._id, translation: value }).unwrap();
      setTyped('');
      setReplaced((r) => ({ ...r, [item._id]: res.item }));
    } catch (err) {
      setSendError(err?.data?.message || "Tarjimani saqlab bo'lmadi. Internetni tekshirib qayta urining.");
    }
  };

  const choose = (opt) => {
    setChosen(opt);
    send({ mode: 'recognize', answer: opt });
  };

  const speech = useSpeechInput({
    lang: 'en-US',
    onResult: (text) => {
      setSentence(text);
      setVoiceText(text);
    },
  });

  // Yangi so'zga o'tganda hamma narsa tozalanadi
  useEffect(() => {
    setSentence('');
    setTyped('');
    setChosen(null);
    setResult(null);
    setSendError(null);
    setVoiceText(null);
    setAnalysis(null);
    setAnalysisError(null);
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 250);
    return () => clearTimeout(t);
  }, [index]);

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

  // Qayta urinish — faqat yozma rejimlarda (tanib olishda javob allaqachon ko'rindi)
  const retry = () => {
    setResult(null);
    setAnalysis(null);
    setAnalysisError(null);
    if (mode === 'recall') setTyped('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const explain = async () => {
    setAnalysisError(null);
    try {
      setAnalysis(await analyzeSentence(sentence).unwrap());
    } catch (err) {
      setAnalysisError(err?.data?.message || "Tahlil hozir ishlamayapti. Keyinroq urinib ko'ring.");
    }
  };

  if (!item) return null;

  const doneCount = index + (result ? 1 : 0);
  const stageNow = result?.stage ?? item.stage ?? 0;
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
          key={item._id}
          initial={{ opacity: 0, x: 32, rotate: 1 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          exit={{ opacity: 0, x: -32, rotate: -1 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-6"
        >
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-card/80 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary ring-1 ring-primary/15">
            <meta.icon className="size-3.5" /> {meta.label}
          </span>
          <WordCard item={item} reveal={result?.reveal} />
        </motion.div>
      </AnimatePresence>

      {/* Topshiriq */}
      {mode === 'recognize' && (
        <div className="space-y-2">
          <p className="text-sm font-bold">{meta.hint}</p>
          <RecognizeTask item={item} disabled={isChecking} result={result} chosen={chosen} onChoose={choose} />
          {!result && <p className="hidden text-xs text-muted-foreground sm:block">Klaviaturada <Kbd>1</Kbd>–<Kbd>4</Kbd> tugmalari ham ishlaydi</p>}
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {!result && mode === 'translate' && (
          <motion.form
            key="translate"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onSubmit={(e) => {
              e.preventDefault();
              submitTranslation();
            }}
            className="space-y-2"
          >
            <label htmlFor="review-translate" className="text-sm font-bold">{meta.hint}</label>
            <p className="text-xs text-muted-foreground">
              Bu so&apos;zning tarjimasi topilmadi. Tinglang, ta&apos;rif va misolga qarang — o&apos;zingiz tushungan ma&apos;noni yozing.
              Keyin so&apos;z odatdagidek variantlardan tanlash bilan davom etadi.
            </p>
            <div className="flex items-center gap-1.5 rounded-2xl border border-input bg-card p-1.5 shadow-xs transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
              <input
                id="review-translate"
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="o'zbekcha tarjima"
                disabled={isSavingTranslation}
                autoComplete="off"
                maxLength={120}
                enterKeyHint="send"
                className="h-11 min-w-0 flex-1 bg-transparent px-3 text-lg outline-none placeholder:text-muted-foreground/70"
              />
              <Button type="submit" size="icon" className="shrink-0 rounded-xl" disabled={isSavingTranslation || !typed.trim()} aria-label="Saqlash">
                {isSavingTranslation ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </div>
          </motion.form>
        )}

        {!result && mode === 'recall' && (
          <motion.form
            key="recall"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            onSubmit={(e) => {
              e.preventDefault();
              submitRecall();
            }}
            className="space-y-2"
          >
            <label htmlFor="review-recall" className="text-sm font-bold">{meta.hint}</label>
            <div className="flex items-center gap-1.5 rounded-2xl border border-input bg-card p-1.5 shadow-xs transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
              <input
                id="review-recall"
                ref={inputRef}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="inglizcha so'z"
                disabled={isChecking}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="send"
                className="h-11 min-w-0 flex-1 bg-transparent px-3 text-lg outline-none placeholder:text-muted-foreground/70"
              />
              <Button type="submit" size="icon" className="shrink-0 rounded-xl" disabled={isChecking || !typed.trim()} aria-label="Tekshirish">
                {isChecking ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </div>
          </motion.form>
        )}

        {!result && mode === 'sentence' && (
          <motion.form
            key="sentence"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: EASE }}
            onSubmit={(e) => {
              e.preventDefault();
              submitSentence();
            }}
            className="space-y-3"
          >
            <label htmlFor="review-sentence" className="text-sm font-bold">{meta.hint}</label>
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
                placeholder={speech.listening ? 'Eshitmoqdaman…' : `I ... ${item.word} ...`}
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
                  {speech.listening && <span className="absolute inset-0 animate-ping rounded-xl bg-destructive/40" aria-hidden="true" />}
                  {speech.listening ? <MicOff /> : <Mic />}
                </Button>
              )}
              <Button type="submit" size="icon" className="shrink-0 rounded-xl" disabled={isChecking || speech.listening || !sentence.trim()} aria-label="Yuborish">
                {isChecking ? <Loader2 className="animate-spin" /> : <Send />}
              </Button>
            </div>

            {speech.error && <p className="text-sm text-destructive">{speech.error}</p>}
            {voiceUnchanged ? (
              <p className="text-xs font-medium text-primary">Mikrofon shunday tanidi. Tekshiring, kerak bo&apos;lsa tuzating va yuboring.</p>
            ) : speech.supported ? (
              <p className="text-xs text-muted-foreground">
                Yozib ham, mikrofonga aytib ham bo&apos;ladi. Ovozli javobda talaffuz emas, aytilgan gapning matni tekshiriladi.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Bu brauzer mikrofonli javobni qo&apos;llab-quvvatlamaydi — gapni yozing.</p>
            )}
          </motion.form>
        )}
      </AnimatePresence>

      {/* Tarmoq xatosi */}
      <AnimatePresence>
        {sendError && !result && (
          <motion.div role="alert" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="space-y-2 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="flex items-start gap-2">
                <WifiOff className="mt-0.5 size-4 shrink-0 text-warning" />
                <span>{sendError} Javobingiz saqlanib qoldi — qayta yuborishingiz mumkin.</span>
              </p>
              <button type="button" onClick={goNext} className="text-xs font-bold text-muted-foreground underline underline-offset-2 hover:text-foreground">
                {isLast ? 'Hozircha yakunlash' : "Bu so'zni keyinroq takrorlash"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Natija */}
      <AnimatePresence>
        {result && (
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
              className={cn('rounded-2xl border p-4 sm:p-5', result.isCorrect ? 'border-success/35 bg-success/8' : 'border-destructive/35 bg-destructive/8')}
            >
              <div className="flex items-start gap-3">
                <motion.span
                  ref={resultIconRef}
                  initial={{ scale: 0.3, rotate: -40 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                  className="mt-0.5 shrink-0"
                >
                  {result.isCorrect ? <CheckCircle2 className="size-7 text-success" /> : <XCircle className="size-7 text-destructive" />}
                </motion.span>
                <div className="min-w-0 flex-grow">
                  <p className="text-lg font-extrabold">{result.isCorrect ? "To'g'ri!" : "Hali to'g'ri emas"}</p>

                  {mode === 'sentence' && (
                    <p className="mt-1 break-words text-sm">
                      <span className="text-muted-foreground">Sizning gapingiz: </span>
                      <span className="italic">{sentence}</span>
                    </p>
                  )}
                  {mode === 'recall' && (
                    <p className="mt-1 text-sm">
                      <span className="text-muted-foreground">Siz yozdingiz: </span>
                      <span className="font-semibold">{typed}</span>
                    </p>
                  )}
                  {(mode === 'sentence' || !result.isCorrect || result.nearMiss) && <p className="mt-1.5 text-sm">{result.feedback}</p>}

                  {result.corrected && result.corrected !== sentence && (
                    <p className="mt-2 rounded-xl bg-card/70 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">To&apos;g&apos;ri variant: </span>
                      <span className="font-semibold">{result.corrected}</span>
                    </p>
                  )}

                  {result.practice && (
                    <p className="mt-2 text-xs text-muted-foreground">Mashq: bu so&apos;zning bugungi takrorlashi hisoblangan, bosqich o&apos;zgarmadi.</p>
                  )}

                  {result.learned && !result.practice ? (
                    <p className="mt-2 flex items-center gap-1 text-sm font-bold text-success">
                      <Sparkles className="size-4" /> Bu so&apos;z yodlangan so&apos;zlarga o&apos;tdi!
                    </p>
                  ) : (
                    nextLabel && (
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <CalendarClock className="size-3.5 shrink-0" /> {nextLabel}
                      </p>
                    )
                  )}

                  {result.method === 'local' && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> {localCheckNote(result)}
                    </p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Gap tahlili — faqat AI tekshirgan gap uchun */}
            {mode === 'sentence' && result.method === 'ai' && !analysis && (
              <Button type="button" variant="soft" onClick={explain} disabled={isAnalyzing} className="w-full">
                {isAnalyzing ? (<><Loader2 className="animate-spin" /> Tahlil qilinmoqda…</>) : (<><ScanText /> Gapimni tushuntir</>)}
              </Button>
            )}
            {analysisError && <p className="text-sm text-destructive">{analysisError}</p>}
            <AnimatePresence>
              {analysis && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                  <div className="rounded-2xl border border-border bg-card p-4">
                    <SentenceBreakdown analysis={analysis} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-2">
              {!result.isCorrect && mode !== 'recognize' && (
                <Button type="button" variant="outline" size="lg" className="flex-1" onClick={retry}>
                  <RotateCcw /> Qayta urinish
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
