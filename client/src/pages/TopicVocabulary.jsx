import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'motion/react';
import {
  useGetCurrentTopicQuery,
  useStartTopicQuizMutation,
  useSubmitTopicQuizMutation,
  useFinishTopicDayMutation,
  useGetWordsQuery,
  useGetMeQuery,
  useGetActiveWordsQuery,
} from '../features/api/apiSlice';
import { setCredentials } from '../features/auth/authSlice';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState, IconTile, PageSkeleton, ProgressBar } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import {
  Loader2,
  CheckCircle2,
  Volume2,
  Check,
  ArrowRight,
  ChevronLeft,
  Sparkles,
  MessagesSquare,
  Headphones,
  Lightbulb,
  Trophy,
  BookCheck,
  RotateCcw,
  PartyPopper,
  AlertTriangle,
  Mic,
  Brain,
  PenLine,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { playTTSAudio } from '../utils/audio';
import { fireConfetti } from '../utils/celebration';
import { track, EVENTS } from '../lib/analytics';
import DialoguePractice from '../components/DialoguePractice';
import ActiveWords from '../components/ActiveWords';

const EASE = [0.16, 1, 0.3, 1];

/**
 * Mini-test.
 *
 * Ilgari savollar ham, to'g'ri javob ham shu komponentda edi va natija
 * `sessionStorage` ga yozilardi — DevTools'dan bitta qator bilan butun kunni
 * o'tkazib yuborish mumkin edi. Chalg'ituvchi variantlar esa
 * ['Boshqa ma'no', 'Noto'g'ri tarjima', ...] kabi shablonlar edi: foydalanuvchi
 * bir necha savoldan keyin so'zni bilmasdan ham 100% to'plardi.
 *
 * Endi savollar serverdan keladi, to'g'ri javob mijozga umuman yuborilmaydi,
 * baholash ham serverda bo'ladi.
 */
const TopicQuiz = ({ quiz, onPass, onBack, submitQuiz, isSubmitting }) => {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState(null);

  const questions = quiz?.questions || [];
  const q = questions[idx];

  const finish = async (finalAnswers) => {
    try {
      const res = await submitQuiz({ quizId: quiz.quizId, answers: finalAnswers }).unwrap();
      setResults(res);
      if (res.passed) {
        toast.success(`Test o'tdi — ${res.score}%`);
        onPass(res);
      } else {
        toast.error(`Natija ${res.score}%. Kamida ${res.passPercent}% kerak.`);
      }
    } catch {
      toast.error("Testni tekshirishda xatolik. Qayta urinib ko'ring.");
    }
  };

  const handlePick = (optionIndex) => {
    if (selected !== null || isSubmitting) return;
    setSelected(optionIndex);
    const next = [...answers, optionIndex];

    setTimeout(() => {
      setAnswers(next);
      if (idx < questions.length - 1) {
        setIdx((i) => i + 1);
        setSelected(null);
      } else {
        finish(next);
      }
    }, 400);
  };

  const retry = () => {
    setIdx(0);
    setAnswers([]);
    setSelected(null);
    setResults(null);
    onBack();
  };

  if (results && !results.passed) {
    return (
      <div className="text-center">
        <IconTile icon={RotateCcw} tone="warning" size="lg" className="mx-auto mb-4" />
        <h3 className="text-2xl font-extrabold">Natija: {results.score}%</h3>
        <p className="mt-1 text-muted-foreground">
          O&apos;tish uchun {results.passPercent}% kerak. Adashgan so&apos;zlarni qayta ko&apos;rib chiqing.
        </p>
        <div className="mt-6 space-y-2 text-left">
          {results.results.filter((r) => !r.correct).map((r) => (
            <div key={r.word} className="rounded-2xl border border-destructive/25 bg-destructive/6 px-4 py-3">
              <span className="font-bold">{r.word}</span>
              <span className="text-muted-foreground"> — {r.correctAnswer}</span>
            </div>
          ))}
        </div>
        <Button onClick={retry} size="lg" className="mt-6">
          <ChevronLeft /> So&apos;zlarga qaytish
        </Button>
      </div>
    );
  }

  if (!q) return null;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Orqaga">
          <ChevronLeft />
        </Button>
        <ProgressBar value={idx} max={questions.length} className="h-2 flex-1" label="Mini-test jarayoni" />
        <span className="text-sm font-bold tabular">
          {idx + 1}<span className="text-muted-foreground">/{questions.length}</span>
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <p className="text-sm font-semibold text-muted-foreground">Bu so&apos;z nimani anglatadi?</p>
          <h3 className="mt-1 mb-6 text-4xl font-extrabold tracking-tight">{q.word}</h3>
          <div className="space-y-3">
            {q.options.map((opt, optionIndex) => (
              <button
                key={opt}
                type="button"
                onClick={() => handlePick(optionIndex)}
                disabled={selected !== null || isSubmitting}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border-2 p-4 text-left font-medium transition-[border-color,background-color,opacity] active:scale-[0.99]',
                  selected === optionIndex ? 'border-primary bg-primary/8' : 'border-border bg-card hover:border-primary/40',
                  selected !== null && selected !== optionIndex && 'opacity-50'
                )}
              >
                <span
                  className={cn(
                    'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                    selected === optionIndex ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {String.fromCharCode(65 + optionIndex)}
                </span>
                {opt}
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
      {isSubmitting && (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Tekshirilmoqda…
        </p>
      )}
    </div>
  );
};

/** O'rganish → mini-test → gapirish (shadowing) → sizning so'zlaringiz → yakunlash */
const Stepper = ({ current, quizPassed, hasDialogue, shadowDone, hasActive, activeDone }) => {
  const steps = [
    { key: 'learn', label: "O'rganish", done: quizPassed || current !== 'learn' },
    { key: 'quiz', label: 'Mini-test', done: quizPassed },
    ...(hasDialogue ? [{ key: 'shadow', label: 'Gapirish', done: shadowDone }] : []),
    ...(hasActive ? [{ key: 'active', label: "So'zlaringiz", done: activeDone }] : []),
    { key: 'finish', label: 'Yakunlash', done: false },
  ];
  return (
    <ol className="flex items-center gap-2" aria-label="Sahna qadamlari">
      {steps.map((s, i) => {
        const active = s.key === current;
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                s.done ? 'bg-success text-success-foreground' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}
            >
              {s.done ? <Check className="size-4" strokeWidth={3} /> : i + 1}
            </span>
            <span className={cn('hidden text-sm font-semibold sm:inline', active ? 'text-foreground' : 'text-muted-foreground')}>
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
};

const TopicVocabulary = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = useSelector((s) => s.auth.token);
  const { data: topicData, isLoading } = useGetCurrentTopicQuery();
  const { data: user } = useGetMeQuery();
  const [finishTopicDay, { isLoading: isFinishing }] = useFinishTopicDayMutation();
  const [startQuiz, { isLoading: isStartingQuiz }] = useStartTopicQuizMutation();
  const [submitQuiz, { isLoading: isSubmittingQuiz }] = useSubmitTopicQuizMutation();
  const { data: userWords = [] } = useGetWordsQuery();

  const [step, setStep] = useState('intro');
  // Yakunlashda lug'atga avtomatik qo'shilgan so'zlar soni (server javobi)
  const [wordsAdded, setWordsAdded] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [shadowDone, setShadowDone] = useState(false);
  const [activeDone, setActiveDone] = useState(false);
  // Ixtiyoriy yakuniy qadam: dialogni yoddan aytish
  const [recallOpen, setRecallOpen] = useState(false);
  const [recallResult, setRecallResult] = useState(null);
  const healRef = useRef(false);

  // Test o'tilgani SERVERDAN keladi. Ilgari bu sessionStorage'da edi.
  const quizPassed = Boolean(topicData?.quizPassed);
  const pack = useMemo(() => topicData?.words || [], [topicData?.words]);
  const savedSet = useMemo(() => new Set(userWords.map((w) => w.word.toLowerCase())), [userWords]);

  // So'zlar yakunlashda avtomatik saqlanadi — faqat mini-test talab qilinadi
  const canFinish = pack.length === 0 || quizPassed;

  // Dialogda birinchi gapiruvchi chapda, qolganlari o'ngda — chat kabi
  const firstSpeaker = topicData?.dialogue?.[0]?.speaker;
  const hasDialogue = (topicData?.dialogue?.length || 0) > 0;

  // "Sizning so'zlaringiz": lug'atdagi so'zlar shu mavzu gaplarida (2+ bo'lsa)
  const { data: activeData } = useGetActiveWordsQuery(undefined, {
    skip: !topicData || topicData.isFinished || topicData.topicQuestCompleted,
  });
  const activeItems = activeData?.items || [];
  const hasActive = activeItems.length > 0;

  // Mini-testdan keyingi bajarilmagan ixtiyoriy qadam
  const pendingStep = hasDialogue && !shadowDone ? 'shadow' : hasActive && !activeDone ? 'active' : null;

  const applyUserUpdate = useCallback(
    (profile) => {
      if (profile && token) {
        dispatch(setCredentials({ user: profile, token }));
      }
    },
    [dispatch, token]
  );

  const handleFinishDay = useCallback(async () => {
    try {
      // Test natijasini server o'zi tekshiradi — mijoz `quizPassed` yubormaydi
      const res = await finishTopicDay({}).unwrap();
      applyUserUpdate(res.user);
      setWordsAdded(res.wordsAdded ?? null);
      fireConfetti();
      toast.success(res.message || 'Kunlik sahna bajarildi!');
      track(EVENTS.TOPIC_DAY_FINISHED, {
        day: topicData?.day,
        cefr: topicData?.cefr,
        wordsSaved: res.wordsAdded ?? 0,
      });
      // Takrorlash oldinroq bajarilgan bo'lsa, kunlik reja aynan shu yerda tugaydi
      if (res.planCompleted && res.streakUpdated) {
        track(EVENTS.DAILY_PLAN_COMPLETED, {
          streak: res.user?.currentStreak,
          level: res.user?.level,
        });
      }
      setStep('done');
    } catch (err) {
      const msg = err?.data?.error || 'Yakunlashda xatolik';
      toast.error(msg);
      if (err?.data?.code === 'QUIZ_REQUIRED') setStep('learn');
    }
  }, [finishTopicDay, applyUserUpdate, topicData?.cefr, topicData?.day]);

  const handleStartQuiz = useCallback(async () => {
    try {
      const res = await startQuiz().unwrap();
      setQuiz(res);
      setStep('quiz');
    } catch (err) {
      toast.error(err?.data?.error || 'Testni boshlashda xatolik');
    }
  }, [startQuiz]);

  useEffect(() => {
    if (topicData?.topicQuestCompleted && step !== 'done') {
      setStep('done');
    }
  }, [topicData?.topicQuestCompleted, step]);

  useEffect(() => {
    if (healRef.current || isLoading || !topicData) return;
    if (topicData.isCompleteForToday && !topicData.topicQuestCompleted) {
      healRef.current = true;
      handleFinishDay();
    }
  }, [topicData, isLoading, handleFinishDay]);

  if (isLoading) return <PageSkeleton cards={2} />;

  if (topicData?.isFinished) {
    return (
      <EmptyState
        icon={Trophy}
        tone="xp"
        title="Barcha mavzular tugadi!"
        description="Siz kursning hamma sahnalarini o'tdingiz. Takrorlash va qo'shimcha mashqlar bilan davom eting."
      >
        <Button asChild size="lg">
          <Link to="/">Bosh sahifa</Link>
        </Button>
      </EmptyState>
    );
  }

  if (!topicData) {
    return (
      <EmptyState
        icon={AlertTriangle}
        tone="warning"
        title="Sahnani yuklab bo'lmadi"
        description="Internet aloqasini tekshirib, sahifani yangilang."
      >
        <Button onClick={() => window.location.reload()}>Yangilash</Button>
      </EmptyState>
    );
  }

  if (recallOpen && hasDialogue) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
        className="surface mx-auto max-w-2xl p-5 sm:p-8"
      >
        <Button variant="ghost" size="sm" className="-ml-2 mb-3" onClick={() => setRecallOpen(false)}>
          <ChevronLeft /> Orqaga
        </Button>
        <DialoguePractice
          dialogue={topicData.dialogue}
          mode="recall"
          doneLabel="Tugatish"
          onDone={(res) => {
            setRecallResult(res);
            setRecallOpen(false);
            track(EVENTS.DIALOGUE_RECALLED, { day: topicData?.day, average: res.average });
            if (res.average != null && res.average >= 80) fireConfetti(1200);
          }}
        />
      </motion.section>
    );
  }

  if (step === 'done' || topicData.topicQuestCompleted) {
    const reviewDone = user?.dailyQuests?.reviewCompleted;
    return (
      <div className="mx-auto max-w-xl space-y-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="hero-mesh noise relative mx-auto max-w-xl overflow-hidden rounded-[1.75rem] p-8 text-center text-white sm:p-10"
      >
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 }}
          className="mx-auto mb-5 inline-flex size-20 items-center justify-center rounded-3xl bg-white/15"
        >
          <PartyPopper className="size-10" />
        </motion.div>
        <h1 className="text-3xl font-extrabold">Kunlik sahna bajarildi!</h1>
        {wordsAdded > 0 && (
          <p className="mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">
            <BookCheck className="size-4" /> {wordsAdded} ta so&apos;z lug&apos;atingizga qo&apos;shildi
          </p>
        )}
        <p className="mx-auto mt-2 max-w-sm text-white/80">
          {reviewDone
            ? "Bugungi reja to'liq bajarildi. Ertaga yangi sahna ochiladi."
            : "Keyingi qadam: “Bugun” sahifasida yangi so'zlarni takrorlash."}
        </p>
        {/* Takrorlash endi "Bugun" sahifasining o'zida — alohida /review sahifasi yo'q */}
        <Button size="xl" className="mt-8 w-full bg-white text-primary shadow-lg hover:bg-white/90 sm:w-auto" onClick={() => navigate('/')}>
          {reviewDone ? 'Bosh sahifaga qaytish' : "Takrorlashga o'tish"}
          <ArrowRight />
        </Button>
      </motion.div>

      {/* Ixtiyoriy: dialogni yoddan aytish — kunlik rejaga kirmaydi */}
      {hasDialogue && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4, ease: EASE }}
          onClick={() => setRecallOpen(true)}
          className="surface-interactive flex w-full items-center gap-4 p-5 text-left"
        >
          <IconTile icon={Brain} tone="streak" />
          <span className="min-w-0 flex-1">
            <span className="block font-bold">Qo&apos;shimcha: dialogni yoddan ayting</span>
            <span className="block text-sm text-muted-foreground">
              {recallResult?.average != null
                ? `Oxirgi natija: ${recallResult.average}% · yana urinib ko'ring`
                : "Rol tanlang va o'z qatorlaringizni inglizcha yoddan ayting"}
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
        </motion.button>
      )}
      </div>
    );
  }

  const progressStep = ['quiz', 'shadow', 'active'].includes(step) ? step : quizPassed ? 'finish' : 'learn';

  return (
    <div className="mx-auto max-w-3xl">
      {/* Sarlavha */}
      <div className="mb-6 space-y-5">
        <div className="flex items-start gap-4">
          <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-3xl" aria-hidden="true">
            {topicData.scenarioEmoji || '📚'}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">
              Kunlik sahna · {topicData.day}-kun{topicData.cefr ? ` · ${topicData.cefr}` : ''}
            </p>
            <h1 className="mt-1 text-[1.75rem] font-extrabold leading-tight sm:text-3xl">
              {topicData.topicUz || topicData.topic}
            </h1>
          </div>
        </div>
        <Stepper
          current={progressStep}
          quizPassed={quizPassed}
          hasDialogue={hasDialogue}
          shadowDone={shadowDone}
          hasActive={hasActive}
          activeDone={activeDone}
        />
      </div>

      <AnimatePresence mode="wait">
        {step === 'intro' && (
          <motion.section
            key="intro"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="surface p-6 sm:p-8"
          >
            <p className="text-[17px] leading-relaxed">{topicData.story}</p>
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {[
                { icon: MessagesSquare, text: 'Dialogni o\'qing va tinglang' },
                { icon: Sparkles, text: 'Mini-testdan o\'ting' },
                ...(hasDialogue ? [{ icon: Mic, text: 'Dialogni eshitib takrorlang' }] : []),
                ...(hasActive ? [{ icon: PenLine, text: "Lug'atingizdagi so'zlarni gapda ishlating" }] : []),
                { icon: BookCheck, text: "So'zlar lug'atga o'zi qo'shiladi" },
              ].map((s, i) => (
                <div key={s.text} className="flex items-center gap-3 rounded-2xl bg-muted/60 p-3 text-sm font-medium">
                  <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-xs font-bold text-primary shadow-xs">
                    {i + 1}
                  </span>
                  {s.text}
                </div>
              ))}
            </div>
            <div className="mt-6">
              {pack.length === 0 ? (
                <Button size="xl" onClick={handleFinishDay} disabled={isFinishing} className="w-full sm:w-auto">
                  {isFinishing ? <Loader2 className="animate-spin" /> : 'Kunlik sahnani yakunlash'}
                </Button>
              ) : (
                <Button size="xl" variant="brand" onClick={() => setStep('learn')} className="w-full sm:w-auto">
                  Boshlash <ArrowRight />
                </Button>
              )}
            </div>
          </motion.section>
        )}

        {step === 'learn' && (
          <motion.div
            key="learn"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="space-y-6"
          >
            {topicData.dialogue?.length > 0 && (
              <section className="surface p-4 sm:p-6" aria-labelledby="dialog-title">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 id="dialog-title" className="flex items-center gap-2 text-lg font-extrabold">
                    <MessagesSquare className="size-5 text-primary" /> Dialog
                  </h2>
                  <Button
                    variant="soft"
                    size="sm"
                    onClick={() => playTTSAudio(topicData.dialogue.map((l) => l.en).join(' '), 'en-GB', 0.9)}
                  >
                    <Volume2 /> Butunini eshitish
                  </Button>
                </div>

                {topicData.grammarFocus && (
                  <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-warning/30 bg-warning/8 p-3 text-sm">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" />
                    <p>
                      <span className="font-bold">Grammatika: </span>
                      {topicData.grammarFocus}
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  {topicData.dialogue.map((line, i) => {
                    const mine = line.speaker !== firstSpeaker;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.04 * i, duration: 0.35, ease: EASE }}
                        className={cn('flex', mine ? 'justify-end' : 'justify-start')}
                      >
                        <div className={cn('max-w-[88%] sm:max-w-[75%]', mine && 'text-right')}>
                          <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            {line.speaker}
                          </p>
                          <button
                            type="button"
                            onClick={() => playTTSAudio(line.en, 'en-GB', 0.9)}
                            className={cn(
                              'group rounded-2xl px-4 py-3 text-left transition-transform active:scale-[0.99]',
                              mine
                                ? 'rounded-tr-md bg-primary text-primary-foreground'
                                : 'rounded-tl-md bg-muted text-foreground'
                            )}
                            aria-label={`Tinglash: ${line.en}`}
                          >
                            <span className="flex items-start gap-2">
                              <span className="font-medium leading-snug">{line.en}</span>
                              <Volume2 className="mt-0.5 size-4 shrink-0 opacity-60 transition-opacity group-hover:opacity-100" />
                            </span>
                            <span className={cn('mt-1 block text-sm', mine ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                              {line.uz}
                            </span>
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Dialogni o'qigach — uni tinglab yozib ko'rish */}
                <Link
                  to="/listening"
                  className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-teal-500/25 bg-teal-500/6 p-3 transition-colors hover:bg-teal-500/12"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-teal-700 dark:text-teal-300">
                    <Headphones className="size-4" />
                    Shu dialogni tinglab yozib ko&apos;ring
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-teal-600" />
                </Link>
              </section>
            )}

            {/* So'zlar */}
            <section aria-labelledby="words-title">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="words-title" className="text-lg font-extrabold">Bugungi so&apos;zlar</h2>
                  <p className="text-sm text-muted-foreground">
                    Sahnani yakunlaganingizda hammasi lug&apos;atingizga qo&apos;shiladi va takrorlashda chiqadi
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {pack.map((w, index) => {
                  const saved = savedSet.has(w.word.toLowerCase());
                  return (
                    <motion.article
                      key={w.word}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.03 * index, duration: 0.35, ease: EASE }}
                      className="surface p-4 sm:p-5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <h3 className="text-xl font-extrabold tracking-tight">{w.word}</h3>
                            {w.phonetic && <span className="font-ipa text-sm text-muted-foreground">{w.phonetic}</span>}
                            {w.partOfSpeech && <Badge variant="outline">{w.partOfSpeech}</Badge>}
                            {saved && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                                <Check className="size-3.5" strokeWidth={3} /> Lug&apos;atda
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-semibold text-primary">{w.translation}</p>
                          {w.definition && <p className="mt-1 text-sm text-muted-foreground">{w.definition}</p>}
                          {w.example && (
                            <div className="mt-3 border-l-2 border-primary/30 pl-3 text-sm">
                              <p className="italic">{w.example}</p>
                              {w.exampleUz && <p className="mt-0.5 text-muted-foreground">{w.exampleUz}</p>}
                            </div>
                          )}
                          {w.collocations?.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {w.collocations.map((c) => (
                                <span key={c} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col gap-2">
                          <Button
                            variant="outline"
                            size="icon-sm"
                            className="rounded-full"
                            onClick={() => playTTSAudio(w.word, 'en-GB', 1.0)}
                            aria-label={`"${w.word}" talaffuzini eshitish`}
                          >
                            <Volume2 />
                          </Button>
                        </div>
                      </div>
                    </motion.article>
                  );
                })}
              </div>
            </section>

            {/* Harakatlar — telefonda pastda yopishib turadi */}
            <div className="glass sticky bottom-[calc(env(safe-area-inset-bottom,0px)+3.875rem)] z-20 -mx-4 border-t border-border px-4 py-3 sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setStep('intro')}>
                  <ChevronLeft /> Orqaga
                </Button>
                <div className="flex-1" />
                {!quizPassed && pack.length > 0 && (
                  <Button size="lg" onClick={handleStartQuiz} disabled={isStartingQuiz}>
                    {isStartingQuiz ? <Loader2 className="animate-spin" /> : <>Mini-test <Sparkles /></>}
                  </Button>
                )}
                {quizPassed && pendingStep && (
                  <Button size="lg" variant="ghost" onClick={handleFinishDay} disabled={isFinishing}>
                    Yakunlash
                  </Button>
                )}
                {quizPassed && pendingStep && (
                  <Button size="lg" variant="brand" onClick={() => setStep(pendingStep)}>
                    {pendingStep === 'shadow' ? <>Gapirish <Mic /></> : <>So&apos;zlaringiz <PenLine /></>}
                  </Button>
                )}
                {quizPassed && !pendingStep && (
                  <Button size="lg" variant="success" onClick={handleFinishDay} disabled={isFinishing || !canFinish}>
                    {isFinishing ? <Loader2 className="animate-spin" /> : <>Yakunlash <CheckCircle2 /></>}
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {step === 'quiz' && quiz && (
          <motion.section
            key="quiz"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="surface mx-auto max-w-xl p-5 sm:p-8"
          >
            <TopicQuiz
              quiz={quiz}
              submitQuiz={submitQuiz}
              isSubmitting={isSubmittingQuiz}
              onPass={(res) => {
                track(EVENTS.TOPIC_QUIZ_PASSED, { day: topicData?.day, score: res?.score });
                setStep(pendingStep || 'learn');
              }}
              onBack={() => setStep('learn')}
            />
          </motion.section>
        )}

        {step === 'shadow' && hasDialogue && (
          <motion.section
            key="shadow"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="surface mx-auto max-w-2xl p-5 sm:p-8"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setStep('learn')}>
                <ChevronLeft /> So&apos;zlar
              </Button>
              {/* Gapirish majburiy emas: shovqinli joy, mikrofon yo'q va h.k. */}
              <Button variant="ghost" size="sm" onClick={handleFinishDay} disabled={isFinishing}>
                O&apos;tkazib yuborib yakunlash
              </Button>
            </div>
            <DialoguePractice
              dialogue={topicData.dialogue}
              mode="shadow"
              doneLabel={hasActive && !activeDone ? 'Davom etish' : 'Yakunlash'}
              onDone={(res) => {
                setShadowDone(true);
                track(EVENTS.DIALOGUE_SHADOWED, { day: topicData?.day, average: res.average });
                if (hasActive && !activeDone) setStep('active');
                else handleFinishDay();
              }}
            />
          </motion.section>
        )}

        {step === 'active' && hasActive && (
          <motion.section
            key="active"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="surface mx-auto max-w-2xl p-5 sm:p-8"
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setStep('learn')}>
                <ChevronLeft /> So&apos;zlar
              </Button>
              <Button variant="ghost" size="sm" onClick={handleFinishDay} disabled={isFinishing}>
                O&apos;tkazib yuborib yakunlash
              </Button>
            </div>
            <ActiveWords
              items={activeItems}
              onDone={(res) => {
                setActiveDone(true);
                track(EVENTS.ACTIVE_WORDS_DONE, { day: topicData?.day, total: res.total, mistakes: res.mistakes });
                handleFinishDay();
              }}
            />
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TopicVocabulary;
