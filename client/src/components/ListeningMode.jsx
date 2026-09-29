import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  useGetListeningSessionQuery,
  useCheckDictationMutation,
  useCompleteListeningMutation,
} from '../features/api/apiSlice';
import { Headphones, Volume2, Rabbit, Turtle, Loader2, CheckCircle2, Eye, EyeOff, ArrowRight, BookHeart, Trophy } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { EmptyState, PageHeader, PageSkeleton, ProgressBar } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { playTTSAudio } from '../utils/audio';
import { fireConfetti } from '../utils/celebration';
import { track, EVENTS } from '../lib/analytics';

const EASE = [0.16, 1, 0.3, 1];

const TOKEN_STYLES = {
  correct: 'bg-success/12 text-success',
  missing: 'bg-warning/18 font-bold text-[color-mix(in_oklch,var(--warning)_60%,var(--foreground))] underline decoration-dotted underline-offset-4',
  extra: 'bg-destructive/10 text-destructive line-through',
};
const TOKEN_TITLES = { missing: "Bu so'z yozilmagan", extra: "Ortiqcha so'z", correct: "To'g'ri" };

/**
 * Tinglab yozish (diktant).
 *
 * Bu ilovadagi yagona INPUT mashqi. Ilgari faqat output bor edi — yozish va
 * gapirish. Til o'rganishning katta qismi tushunarli input orqali kechadi,
 * shuning uchun bu eng katta bo'shliq edi.
 *
 * Ovoz brauzerning speechSynthesis'i bilan chiqariladi: tashqi TTS xizmatiga
 * pul to'lashsiz ishlaydi va oflayn ham chiqadi. Kamchiligi — ovoz sifati
 * qurilmaga bog'liq; matn ham mijozda bo'ladi, lekin bu mashq hech narsani
 * ochmaydi, shuning uchun "aldash" faqat aldayotgan odamga zarar.
 */
const ListeningMode = () => {
  const { data: session, isLoading } = useGetListeningSessionQuery();
  const [checkDictation, { isLoading: isChecking }] = useCheckDictationMutation();
  const [completeListening] = useCompleteListeningMutation();

  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [scores, setScores] = useState([]);
  const [finished, setFinished] = useState(false);
  const [playing, setPlaying] = useState(null);
  const inputRef = useRef(null);

  const lines = session?.lines || [];
  const line = lines[index];

  const speak = (rate, key) => {
    if (!line) return;
    setPlaying(key);
    playTTSAudio(line.en, 'en-GB', rate);
    // speechSynthesis tugaganini ishonchli bildirmaydi — taxminiy davomiylik
    setTimeout(() => setPlaying(null), Math.max(1500, line.en.length * 70 / rate));
  };

  const handleCheck = async () => {
    if (!typed.trim() || !line) return;
    try {
      const res = await checkDictation({ lineIndex: line.index, typed }).unwrap();
      setResult(res);
      setScores((prev) => [...prev, res.score]);
    } catch {
      toast.error("Tekshirishda xatolik. Qayta urinib ko'ring.");
    }
  };

  const handleNext = async () => {
    setResult(null);
    setTyped('');
    setRevealed(false);

    if (index < lines.length - 1) {
      setIndex((i) => i + 1);
      setTimeout(() => inputRef.current?.focus(), 300);
      return;
    }

    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    track(EVENTS.LISTENING_FINISHED, { lines: lines.length, averageScore: avg });

    try {
      const res = await completeListening().unwrap();
      if (res.xpAwarded) {
        fireConfetti();
        toast.success(res.message);
      }
    } catch {
      // XP berilmasa ham mashq bajarildi
    }
    setFinished(true);
  };

  if (isLoading) return <PageSkeleton cards={1} />;

  if (!lines.length) {
    return (
      <EmptyState
        icon={Headphones}
        tone="teal"
        title="Tinglash mashqi hali tayyor emas"
        description="Avval kunlik sahnani oching — mashq o'sha kunning dialogidan tuziladi."
      >
        <Button asChild size="lg">
          <Link to="/topic">
            <BookHeart /> Kunlik sahnaga
          </Link>
        </Button>
      </EmptyState>
    );
  }

  if (finished) {
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="surface mx-auto max-w-lg p-8 text-center"
      >
        <div className="mx-auto mb-5 inline-flex size-20 items-center justify-center rounded-3xl bg-teal-500/12 text-teal-600 dark:text-teal-400">
          <Trophy className="size-10" />
        </div>
        <h1 className="text-2xl font-extrabold">Tinglash mashqi tugadi</h1>
        <p className="mt-2 text-muted-foreground">O&apos;rtacha aniqlik</p>
        <p className="mt-1 text-5xl font-extrabold text-teal-600 tabular dark:text-teal-400">{avg}%</p>
        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link to="/">Bosh sahifa</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/topic">Kunlik sahna</Link>
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Tinglab yozish"
        title={session.topicUz}
        tone="teal"
        icon={Headphones}
        description="Gapni eshiting va eshitganingizni yozing. Kerak bo'lsa sekinlashtiring."
      />

      <div className="mb-5 flex items-center gap-3">
        <span className="text-sm font-bold tabular">
          {index + 1}<span className="text-muted-foreground">/{lines.length}</span>
        </span>
        <ProgressBar value={index + (result ? 1 : 0)} max={lines.length} tone="teal" className="flex-1" label="Mashq jarayoni" />
      </div>

      <AnimatePresence mode="wait">
        <motion.section
          key={index}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="surface p-5 sm:p-7"
        >
          {/* Pleyer */}
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => speak(0.95, 'normal')}
              className="group relative inline-flex size-24 items-center justify-center rounded-full bg-teal-500 text-white shadow-[0_16px_40px_-12px_rgb(20_184_166/0.7)] transition-transform hover:scale-105 active:scale-95"
              aria-label="Gapni tinglash"
            >
              {playing && (
                <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-teal-500/40" />
                  <span className="absolute -inset-3 animate-pulse rounded-full border-2 border-teal-500/30" />
                </>
              )}
              <Volume2 className="relative size-10" />
            </button>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" onClick={() => speak(0.6, 'slow')} className="rounded-full">
                <Turtle /> Sekin
              </Button>
              <Button variant="outline" size="sm" onClick={() => speak(1.15, 'fast')} className="rounded-full">
                <Rabbit /> Tez
              </Button>
            </div>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{line.speaker}</p>
          </div>

          {!result ? (
            <div className="mt-6">
              <label htmlFor="dictation" className="sr-only">Eshitganingizni yozing</label>
              <Textarea
                id="dictation"
                ref={inputRef}
                rows={3}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleCheck();
                  }
                }}
                placeholder="Eshitganingizni shu yerga yozing…"
                autoCapitalize="sentences"
                spellCheck={false}
                className="text-lg focus-visible:border-teal-500 focus-visible:ring-teal-500/15"
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setRevealed((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
                >
                  {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  {revealed ? 'Yashirish' : "Matnni ko'rsatish"}
                </button>
                <span className="hidden text-xs text-muted-foreground sm:inline">Enter — tekshirish</span>
              </div>

              <AnimatePresence>
                {revealed && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <span className="mt-3 block rounded-2xl bg-muted/70 p-3 text-sm">{line.en}</span>
                  </motion.p>
                )}
              </AnimatePresence>

              <Button
                size="lg"
                onClick={handleCheck}
                disabled={isChecking || !typed.trim()}
                className="mt-5 w-full bg-teal-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_6px_16px_-6px_rgb(20_184_166/0.7)] hover:bg-teal-600 hover:brightness-110"
              >
                {isChecking ? <Loader2 className="animate-spin" /> : 'Tekshirish'}
              </Button>
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
              <div className="mb-4 flex items-center justify-between">
                <span
                  className={cn(
                    'text-4xl font-extrabold tabular',
                    result.score >= 90 ? 'text-success' : result.score >= 60 ? 'text-warning' : 'text-destructive'
                  )}
                >
                  {result.score}%
                </span>
                {result.isPerfect && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}>
                    <CheckCircle2 className="size-9 text-success" />
                  </motion.span>
                )}
              </div>

              {/* So'z darajasidagi farq — foydalanuvchi aynan qayerda adashganini ko'radi */}
              <div className="mb-3 flex flex-wrap gap-1.5 rounded-2xl border border-border bg-background p-4">
                {result.tokens.map((t, i) => (
                  <span
                    key={`${t.word}-${i}`}
                    className={cn('rounded-lg px-2 py-1 text-sm', TOKEN_STYLES[t.status] || TOKEN_STYLES.correct)}
                    title={TOKEN_TITLES[t.status]}
                  >
                    {t.word}
                  </span>
                ))}
              </div>
              <div className="mb-4 flex flex-wrap gap-3 text-[11px] font-semibold text-muted-foreground">
                <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-success" /> to&apos;g&apos;ri</span>
                <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-warning" /> tushib qolgan</span>
                <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-destructive" /> ortiqcha</span>
              </div>

              <p className="mb-4 text-sm">{result.feedback}</p>

              <div className="mb-5 rounded-2xl bg-muted/60 p-4">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Asl matn</p>
                <p className="font-semibold">{result.expected}</p>
                <p className="mt-1 text-sm text-muted-foreground">{result.uz}</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="lg" onClick={() => speak(0.6, 'slow')} aria-label="Sekin qayta eshitish">
                  <Volume2 />
                </Button>
                <Button size="lg" onClick={handleNext} className="flex-1" autoFocus>
                  {index < lines.length - 1 ? <>Keyingi gap <ArrowRight /></> : 'Yakunlash'}
                </Button>
              </div>
            </motion.div>
          )}
        </motion.section>
      </AnimatePresence>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Ovoz brauzeringiz yordamida chiqariladi — sifati qurilmaga bog&apos;liq.
      </p>
    </div>
  );
};

export default ListeningMode;
