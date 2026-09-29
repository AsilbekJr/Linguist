import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'react-hot-toast';
import {
  Loader2, ArrowRight, ArrowLeft, Sprout, MessageCircle, Rocket, Mic, BookOpen, Compass,
  Timer, CalendarDays, Trophy, Check,
} from 'lucide-react';
import { useGetMeQuery, useOnboardUserMutation } from '../../features/api/apiSlice';
import { Button } from '@/components/ui/button';
import { IconTile } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { Logo } from '../brand/Logo';
import { ThemeToggle } from '../ThemeToggle';
import PlacementTest from './PlacementTest';

const LEVELS = [
  { id: 'beginner', title: "Boshlang'ich", tag: 'A1–A2', icon: Sprout, tone: 'success', text: "Ko'p so'zlarni endi o'rganyapman." },
  { id: 'intermediate', title: "O'rta", tag: 'B1', icon: MessageCircle, tone: 'info', text: 'Fikrimni tushuntira olaman, xatolar bilan.' },
  { id: 'advanced', title: 'Yuqori', tag: 'B2+', icon: Rocket, tone: 'primary', text: "Erkin gaplashaman, so'z boyligini oshirmoqchiman." },
];

const GOALS = [
  { id: 'speaking', title: "So'zlashuv", icon: Mic, tone: 'pink', text: 'Gapirishda erkinlik va talaffuz.' },
  { id: 'vocabulary', title: "So'z boyligi", icon: BookOpen, tone: 'primary', text: "Yangi so'zlarni mustahkam yodlash." },
  { id: 'general', title: 'Umumiy', icon: Compass, tone: 'teal', text: "Barcha ko'nikmalarni birga o'stirish." },
];

const PLANS = [
  { id: 'sprint', title: 'Sprint', tag: '1 hafta', icon: Timer, tone: 'streak', text: '~15 daqiqa kuniga — odat shakllantirish.' },
  { id: 'foundation', title: 'Poydevor', tag: '1 oy', icon: CalendarDays, tone: 'info', text: "~20 daqiqa kuniga — barqaror o'sish." },
  { id: 'fluency', title: 'Erkinlik', tag: '100 kun', icon: Trophy, tone: 'xp', text: '~30 daqiqa kuniga — kuchli natija.' },
];

const STEP_TITLES = ['Daraja', 'Maqsad', 'Reja'];

/** Tanlanadigan karta */
const Choice = ({ option, selected, onSelect, index }) => (
  <motion.button
    type="button"
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay: 0.05 * index, ease: [0.16, 1, 0.3, 1] }}
    onClick={onSelect}
    aria-pressed={selected}
    className={cn(
      'flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 active:scale-[0.99]',
      selected
        ? 'border-primary bg-primary/6 shadow-[0_8px_24px_-12px_color-mix(in_oklch,var(--primary)_60%,transparent)]'
        : 'border-border bg-card hover:border-primary/35'
    )}
  >
    <IconTile icon={option.icon} tone={option.tone} />
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-2">
        <span className="font-bold">{option.title}</span>
        {option.tag && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{option.tag}</span>
        )}
      </span>
      <span className="mt-0.5 block text-sm text-muted-foreground">{option.text}</span>
    </span>
    <span
      className={cn(
        'inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
      )}
    >
      {selected && <Check className="size-3.5" strokeWidth={3} />}
    </span>
  </motion.button>
);

const StepShell = ({ title, subtitle, children }) => (
  <div>
    <h1 className="text-[1.75rem] font-extrabold leading-tight sm:text-3xl">{title}</h1>
    <p className="mt-2 text-[15px] text-muted-foreground">{subtitle}</p>
    <div className="mt-6 space-y-3">{children}</div>
  </div>
);

/**
 * Onboarding — to'liq ekranli qadamlar.
 * Ilgari bu kichik ekranda aylantirib bo'lmaydigan modal edi: telefonda
 * "Boshladik" tugmasi ekrandan tashqarida qolib ketardi.
 */
const OnboardingModal = () => {
  const { data: user, isLoading: isUserLoading, refetch } = useGetMeQuery();
  const [onboardUser, { isLoading: isSubmitting }] = useOnboardUserMutation();

  // 0 = daraja aniqlash testi. Foydalanuvchi o'tkazib yuborsa 1-qadamga o'tadi
  // va darajani o'zi tanlaydi.
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState({ level: '', goal: '', planType: '' });

  if (isUserLoading || !user || user.onboarding?.completed) return null;

  const go = (next) => {
    setDirection(next > step ? 1 : -1);
    setStep(next);
  };

  const handlePlacementDone = (result) => {
    // O'lchangan daraja oldindan to'ldiriladi va daraja savoli o'tkaziladi
    setAnswers((prev) => ({ ...prev, level: result.learnerLevel }));
    go(2);
  };

  const handleFinish = async () => {
    if (!answers.level || !answers.goal || !answers.planType) {
      toast.error('Iltimos, barcha savollarga javob bering');
      return;
    }
    try {
      await onboardUser(answers).unwrap();
      toast.success("Ajoyib! O'quv rejangiz tayyor.", { icon: '🎯' });
      refetch();
    } catch (error) {
      const msg = error?.data?.errors?.fieldErrors
        ? "Ma'lumotlar noto'g'ri. Qayta urinib ko'ring."
        : error?.data?.message || "Xatolik yuz berdi. Qayta urinib ko'ring.";
      toast.error(msg);
    }
  };

  const pick = (key, value, nextStep) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    if (nextStep != null) setTimeout(() => go(nextStep), 220);
  };

  return (
    <div className="flex min-h-dvh flex-col pb-safe pt-safe">
      <header className="flex items-center justify-between gap-4 px-4 py-4 sm:px-8">
        <Logo />
        <ThemeToggle />
      </header>

      {step > 0 && (
        <div className="mx-auto w-full max-w-xl px-5 sm:px-8">
          <div className="flex items-center gap-2">
            {STEP_TITLES.map((t, i) => (
              <div key={t} className="flex-1">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={false}
                    animate={{ width: step >= i + 1 ? '100%' : '0%' }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <p className={cn('mt-1.5 text-[11px] font-bold uppercase tracking-wider', step >= i + 1 ? 'text-primary' : 'text-muted-foreground')}>
                  {t}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-5 py-6 sm:px-8 sm:py-10">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: direction * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -40 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1"
          >
            {step === 0 && <PlacementTest onDone={handlePlacementDone} onSkip={() => go(1)} />}

            {step === 1 && (
              <StepShell title="Ingliz tili darajangiz qanday?" subtitle="Sizga mos so'zlar va mashqlarni tanlash uchun.">
                {LEVELS.map((opt, i) => (
                  <Choice key={opt.id} index={i} option={opt} selected={answers.level === opt.id} onSelect={() => pick('level', opt.id, 2)} />
                ))}
              </StepShell>
            )}

            {step === 2 && (
              <StepShell title="Asosiy maqsadingiz nima?" subtitle="Bosh sahifada shunga mos mashqni tavsiya qilamiz.">
                {GOALS.map((opt, i) => (
                  <Choice key={opt.id} index={i} option={opt} selected={answers.goal === opt.id} onSelect={() => pick('goal', opt.id, 3)} />
                ))}
              </StepShell>
            )}

            {step === 3 && (
              <StepShell title="Qancha vaqt ajratasiz?" subtitle="Til o'rganishda muntazamlik eng muhimi. O'zingizga mosini tanlang.">
                {PLANS.map((opt, i) => (
                  <Choice key={opt.id} index={i} option={opt} selected={answers.planType === opt.id} onSelect={() => pick('planType', opt.id)} />
                ))}
              </StepShell>
            )}
          </motion.div>
        </AnimatePresence>

        {step > 0 && (
          <div className="sticky bottom-0 -mx-5 mt-8 flex items-center gap-3 bg-gradient-to-t from-background via-background to-transparent px-5 pb-4 pt-6 sm:static sm:mx-0 sm:bg-none sm:p-0">
            <Button variant="ghost" size="lg" onClick={() => go(step - 1)}>
              <ArrowLeft /> Orqaga
            </Button>
            {step === 3 && (
              <Button
                size="lg"
                variant="brand"
                className="flex-1"
                onClick={handleFinish}
                disabled={!answers.planType || isSubmitting}
              >
                {isSubmitting ? <Loader2 className="animate-spin" /> : <>Boshladik <ArrowRight /></>}
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default OnboardingModal;
