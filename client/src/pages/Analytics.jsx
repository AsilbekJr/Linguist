import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useGetMeQuery, useGetWordsQuery } from '../features/api/apiSlice';
import {
  Flame, Star, BookOpen, Trophy, Award, BarChart3, CheckCircle2, Target, Lock, PenLine, Library, CalendarCheck, ChevronRight, Settings as SettingsIcon,
} from 'lucide-react';
import { isLearned } from '../utils/wordStatus';
import {
  AnimatedNumber, IconTile, PageHeader, PageSkeleton, ProgressRing, Stagger, StaggerItem, StatTile,
} from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

/** Server `computeEarnedBadges` bilan bir xil identifikatorlar */
const BADGES = [
  { id: 'first_word', title: "Birinchi so'z", description: "Lug'atga birinchi so'z qo'shildi", icon: PenLine, tone: 'primary' },
  { id: 'words_50', title: "50 so'z", description: "Lug'atda 50 ta so'z", icon: BookOpen, tone: 'info' },
  { id: 'words_250', title: "250 so'z", description: "Lug'atda 250 ta so'z", icon: Library, tone: 'teal' },
  { id: 'streak_7', title: '7 kunlik streak', description: 'Ketma-ket 7 kun faol', icon: Flame, tone: 'streak' },
  { id: 'streak_30', title: '30 kunlik streak', description: 'Ketma-ket 30 kun faol', icon: Trophy, tone: 'xp' },
  { id: 'daily_complete', title: 'Kunlik reja', description: 'Bugungi reja 100% bajarildi', icon: CalendarCheck, tone: 'success' },
];

const LEVEL_LABELS = { beginner: "Boshlang'ich", intermediate: "O'rta", advanced: 'Yuqori' };
const GOAL_LABELS = { speaking: "So'zlashuv", vocabulary: "So'z boyligi", general: 'Umumiy' };
const PLAN_LABELS = { sprint: "Yengil (5 so'z/kun)", foundation: "Barqaror (7 so'z/kun)", fluency: "Jadal (10 so'z/kun)", standard: 'Standart' };

const Analytics = () => {
  const { data: user, isLoading: loadingUser } = useGetMeQuery();
  const { data: words = [], isLoading: loadingWords } = useGetWordsQuery();

  if (loadingUser || loadingWords) return <PageSkeleton cards={6} />;

  const learned = words.filter(isLearned).length;
  const course = user?.course;
  const earned = new Set(user?.badges || []);
  const learnedPct = words.length ? Math.round((learned / words.length) * 100) : 0;
  const cefr = user?.onboarding?.placedCefr;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        eyebrow="Natijalar"
        title="Sizning yo'lingiz"
        icon={BarChart3}
        description="O'rganish statistikangiz va nishonlaringiz."
      />

      {/* Daraja */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="hero-mesh noise relative overflow-hidden rounded-[1.75rem] p-6 text-white sm:p-8"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 size-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <ProgressRing value={course?.done || 0} max={course?.total || 1} size={132} stroke={11} gradientId="level-ring">
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">Kurs</span>
            <span className="text-4xl font-extrabold leading-none">{course?.cefr || '—'}</span>
          </ProgressRing>
          <div className="text-center sm:text-left">
            <p className="text-sm font-medium text-white/75">Bilgan so&apos;zlaringiz</p>
            <p className="text-4xl font-extrabold tabular">
              <AnimatedNumber value={user?.knownWords ?? learned} />
            </p>
            {course && (
              <p className="mt-2 text-sm text-white/80">
                {course.finished ? (
                  <>Kurs tugatildi — {course.totalDays} ta sahnaning hammasi o&apos;tildi</>
                ) : (
                  <>
                    {course.cefr} darajasi: <span className="font-bold text-white tabular">{course.done}/{course.total}</span> sahna
                    {course.nextCefr && <> · keyingisi {course.nextCefr}</>}
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </motion.section>

      {/* Ko'rsatkichlar */}
      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-3" delay={0.1}>
        <StaggerItem><StatTile icon={Flame} tone="streak" value={user?.currentStreak || 0} label="joriy streak" /></StaggerItem>
        <StaggerItem><StatTile icon={Trophy} tone="xp" value={user?.longestStreak || 0} label="eng uzun streak" /></StaggerItem>
        <StaggerItem><StatTile icon={BookOpen} tone="primary" value={words.length} label="lug'atdagi so'zlar" /></StaggerItem>
        <StaggerItem><StatTile icon={CheckCircle2} tone="success" value={learned} label={`yodlangan · ${learnedPct}%`} /></StaggerItem>
        <StaggerItem><StatTile icon={Target} tone="pink" value={course?.daysCompleted ?? 0} label="o'tilgan sahnalar" /></StaggerItem>
        <StaggerItem><StatTile icon={Star} tone="info" value={cefr || '—'} label="aniqlangan daraja (CEFR)" /></StaggerItem>
      </Stagger>

      {/* Nishonlar */}
      <section className="surface p-5 sm:p-6" aria-labelledby="badges-title">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 id="badges-title" className="flex items-center gap-2 text-lg font-extrabold">
            <Award className="size-5 text-xp" /> Nishonlar
          </h2>
          <span className="text-sm font-semibold text-muted-foreground tabular">
            {BADGES.filter((b) => earned.has(b.id)).length}/{BADGES.length}
          </span>
        </div>
        <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-3" gap={0.05}>
          {BADGES.map((badge) => {
            const has = earned.has(badge.id);
            return (
              <StaggerItem
                key={badge.id}
                className={cn(
                  'relative flex flex-col items-center rounded-2xl border p-4 text-center transition-colors',
                  has ? 'border-border bg-card' : 'border-dashed border-border bg-muted/40'
                )}
              >
                <div className={cn('relative mb-3', !has && 'opacity-40 grayscale')}>
                  {has && <div className="absolute inset-0 -z-10 scale-125 rounded-full bg-xp/25 blur-xl" />}
                  <IconTile icon={badge.icon} tone={badge.tone} size="lg" className="rounded-full" />
                  {!has && (
                    <span className="absolute -bottom-1 -right-1 inline-flex size-6 items-center justify-center rounded-full border border-border bg-card">
                      <Lock className="size-3 text-muted-foreground" />
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold">{badge.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{badge.description}</p>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>

      <Link to="/settings" className="surface-interactive group flex items-center gap-4 p-5">
        <IconTile icon={SettingsIcon} tone="muted" />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">Sozlamalar</span>
          <span className="block text-sm text-muted-foreground">
            {LEVEL_LABELS[user?.onboarding?.level] || '—'} · {GOAL_LABELS[user?.onboarding?.goal] || '—'} ·{' '}
            {PLAN_LABELS[user?.onboarding?.planType] || '—'} — daraja, eslatmalar va parolni o&apos;zgartirish
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
};

export default Analytics;
