import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'motion/react';
import { Loader2, Gauge, ArrowRight, Clock, Sparkles } from 'lucide-react';
import { IconTile, ProgressBar } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { toast } from 'react-hot-toast';
import {
  useStartPlacementMutation,
  useAnswerPlacementMutation,
} from '../../features/api/apiSlice';
import { setCredentials } from '../../features/auth/authSlice';
import { Button } from '@/components/ui/button';
import { fireConfetti } from '../../utils/celebration';
import { track } from '../../lib/analytics';

const CEFR_LABEL = {
  A1: { title: 'A1 — Boshlang\'ich', desc: 'Eng kerakli kundalik so\'zlardan boshlaymiz.' },
  A2: { title: 'A2 — Elementar', desc: 'Kundalik vaziyatlarni boshqarishni o\'rganamiz.' },
  B1: { title: 'B1 — O\'rta', desc: 'Fikr bildirish va murakkabroq suhbatlarga o\'tamiz.' },
  B2: { title: 'B2 — O\'rtadan yuqori', desc: 'Nozik ma\'nolar va professional muloqot.' },
};

/**
 * Daraja aniqlash testi.
 *
 * Ilgari foydalanuvchi darajasini o'zi tanlardi — o'z-o'zini baholash til
 * o'rganishda eng ishonchsiz signal. Bundan tashqari tanlangan daraja
 * kontentga umuman ta'sir qilmasdi: hamma 1-kundan boshlardi.
 *
 * Savollar va to'g'ri javoblar serverda — natijani ko'tarib olish mumkin emas.
 */
const PlacementTest = ({ onDone, onSkip }) => {
  const dispatch = useDispatch();
  const token = useSelector((s) => s.auth.token);

  const [sessionId, setSessionId] = useState(null);
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [answeredCount, setAnsweredCount] = useState(0);

  const [startPlacement, { isLoading: isStarting }] = useStartPlacementMutation();
  const [answerPlacement, { isLoading: isAnswering }] = useAnswerPlacementMutation();

  const handleStart = async () => {
    try {
      const res = await startPlacement().unwrap();
      setSessionId(res.sessionId);
      setQuestion(res.question);
      setAnsweredCount(0);
      track('placement_started');
    } catch {
      toast.error("Testni boshlashda xatolik. Qayta urinib ko'ring.");
    }
  };

  const handleAnswer = async (optionIndex) => {
    if (selected !== null || isAnswering) return;
    setSelected(optionIndex);

    try {
      const res = await answerPlacement({
        sessionId,
        itemId: question.itemId,
        answered: optionIndex,
      }).unwrap();

      setAnsweredCount((n) => n + 1);

      setTimeout(() => {
        setSelected(null);
        if (res.done) {
          setResult(res);
          setQuestion(null);
          fireConfetti();
          track('placement_completed', {
            cefr: res.resultCefr,
            correct: res.correctCount,
            total: res.totalQuestions,
          });
          if (res.user && token) {
            dispatch(setCredentials({ user: res.user, token }));
          }
        } else {
          setQuestion(res.question);
        }
      }, 350);
    } catch (err) {
      setSelected(null);
      toast.error(err?.data?.error || 'Javobni yuborishda xatolik');
    }
  };

  // ── Natija ──────────────────────────────────────────────────────────
  if (result) {
    const label = CEFR_LABEL[result.resultCefr] || CEFR_LABEL.A1;
    return (
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 16 }}
          className="brand-gradient mx-auto mb-6 inline-flex size-28 items-center justify-center rounded-[2rem] text-4xl font-extrabold text-white shadow-[0_20px_50px_-15px_color-mix(in_oklch,var(--primary)_80%,transparent)]"
        >
          {result.resultCefr}
        </motion.div>
        <p className="mb-1 text-xs font-bold uppercase tracking-[0.12em] text-primary">Sizning darajangiz</p>
        <h1 className="text-3xl font-extrabold">{label.title}</h1>
        <p className="mt-2 text-muted-foreground">{label.desc}</p>

        <div className="surface mt-6 p-4 text-left text-sm">
          <p className="font-bold">
            {result.correctCount} / {result.totalQuestions} ta to&apos;g&apos;ri javob
          </p>
          {result.startTopic && (
            <p className="mt-1 text-muted-foreground">
              Kurs <span className="font-bold text-foreground">{result.startDay}-kundan</span> boshlanadi:{' '}
              &quot;{result.startTopic.topicUz}&quot;
            </p>
          )}
        </div>

        <Button size="xl" variant="brand" className="mt-6 w-full" onClick={() => onDone?.(result)}>
          Davom etish <ArrowRight />
        </Button>
      </div>
    );
  }

  // ── Savol ─────────────────────────────────────────────────────────────
  if (question) {
    return (
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Daraja aniqlash</p>
          <span className="text-xs font-semibold text-muted-foreground tabular">{answeredCount + 1}-savol</span>
        </div>
        <ProgressBar value={Math.min(answeredCount, 12)} max={12} className="mb-8 h-1.5" label="Test jarayoni" />

        <motion.p
          key={question.itemId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-xl font-bold leading-relaxed sm:text-2xl"
        >
          {question.prompt}
        </motion.p>

        <div className="space-y-3">
          {question.options.map((opt, i) => (
            <motion.button
              key={`${question.itemId}-${opt}`}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i }}
              disabled={selected !== null || isAnswering}
              onClick={() => handleAnswer(i)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left font-medium transition-[border-color,background-color] active:scale-[0.99] disabled:cursor-default',
                selected === i ? 'border-primary bg-primary/8' : 'border-border bg-card hover:border-primary/40',
                selected !== null && selected !== i && 'opacity-50'
              )}
            >
              <span
                className={cn(
                  'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                  selected === i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
            </motion.button>
          ))}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Bilmasangiz taxmin qilmang — noto&apos;g&apos;ri daraja o&apos;rganishni sekinlashtiradi.
        </p>
      </div>
    );
  }

  // ── Boshlash ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center pt-4 text-center sm:pt-10">
      <div className="relative mb-6">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-primary/20 blur-2xl" />
        <IconTile icon={Gauge} tone="primary" size="lg" className="size-20 animate-float rounded-3xl [&_svg]:size-10" />
      </div>
      <h1 className="text-[1.9rem] font-extrabold leading-tight sm:text-4xl">Darajangizni aniqlaymiz</h1>
      <p className="mt-3 max-w-md text-[15px] text-muted-foreground">
        Qisqa test — savollar javobingizga qarab moslashadi. Natijaga ko&apos;ra kurs sizga mos kundan
        boshlanadi va vaqtingiz tejaladi.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 font-medium">
          <Clock className="size-4 text-primary" /> ~2 daqiqa
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 font-medium">
          <Sparkles className="size-4 text-primary" /> ~12 savol
        </span>
      </div>

      <Button size="xl" variant="brand" className="mt-8 w-full max-w-sm" onClick={handleStart} disabled={isStarting}>
        {isStarting ? <Loader2 className="animate-spin" /> : <>Testni boshlash <ArrowRight /></>}
      </Button>

      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="mt-4 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          Keyinroq — darajani o&apos;zim tanlayman
        </button>
      )}
    </div>
  );
};

export default PlacementTest;
