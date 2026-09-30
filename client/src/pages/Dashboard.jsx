import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Flame, Snowflake, GraduationCap, BookOpen, BookHeart, Repeat2, Check, ArrowRight, Quote, Sparkles,
} from 'lucide-react';
import { useGetReviewDueQuery, useGetMeQuery } from '../features/api/apiSlice';
import quotesData from '../data/quotes.json';
import TodayHub from '../components/TodayHub/TodayHub';
import { PRACTICE_NAV } from '../components/Layout/nav';
import {
  IconTile, ProgressBar, ProgressRing, Skeleton, Stagger, StaggerItem, StatTile,
} from '@/components/ui/primitives';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

// Brauzerlarning o'zbekcha lokali to'liq emas — sanani o'zimiz yozamiz
const formatToday = (d = new Date()) => {
  const day = WEEKDAYS[d.getDay()];
  return `${day[0].toUpperCase()}${day.slice(1)}, ${d.getDate()}-${MONTHS[d.getMonth()]}`;
};

const greeting = (h = new Date().getHours()) => {
  if (h >= 5 && h < 11) return 'Xayrli tong';
  if (h >= 11 && h < 17) return 'Xayrli kun';
  if (h >= 17 && h < 23) return 'Xayrli kech';
  return 'Xayrli tun';
};

/** Foydalanuvchi maqsadiga ko'ra tavsiya qilinadigan mashq */
// Gapirish endi kunlik sahnaning o'zida — qo'shimcha mashqlardan eng yaqini tinglash
const RECOMMENDED_BY_GOAL = { speaking: '/listening', vocabulary: '/listening', general: '/analysis' };

const PlanStep = ({ done, icon, title, hint, to, onClick }) => {
  const Comp = to ? Link : 'button';
  return (
    <Comp
      to={to}
      onClick={onClick}
      type={to ? undefined : 'button'}
      className={cn(
        'group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors',
        done ? 'bg-white/10' : 'bg-white/12 hover:bg-white/20'
      )}
    >
      <span
        className={cn(
          'inline-flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors',
          done ? 'bg-white text-primary' : 'bg-white/15 text-white'
        )}
      >
        {done ? (
          <motion.span initial={{ scale: 0.4, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
            <Check className="size-5" strokeWidth={3} />
          </motion.span>
        ) : (
          React.createElement(icon, { className: 'size-5' })
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block font-bold text-white', done && 'opacity-80')}>{title}</span>
        <span className="block truncate text-xs text-white/70">{hint}</span>
      </span>
      {!done && <ArrowRight className="size-4 shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5" />}
    </Comp>
  );
};

const DashboardSkeleton = () => (
  <div className="space-y-6" aria-busy="true" aria-label="Yuklanmoqda">
    <Skeleton className="h-64 rounded-3xl sm:h-56" />
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[76px] rounded-2xl" />)}
    </div>
    <Skeleton className="h-80 rounded-3xl" />
  </div>
);

const Dashboard = () => {
  const authUser = useSelector((state) => state.auth.user);
  const { data: fetchedUser, isLoading: isLoadingUser } = useGetMeQuery();
  const user = fetchedUser || authUser;

  // Butun lug'at (/api/words — 400 so'zda ~180 KB) bu yerda YUKLANMAYDI: sonlar
  // profilda keladi (totalWords, knownWords). Ilgari bosh sahifa faqat so'zlar
  // sonini ko'rsatish uchun butun lug'atni kutardi.
  const { data: dueWords = [], isLoading: isLoadingDue } = useGetReviewDueQuery();

  const dailyQuote = useMemo(() => {
    const todayInt = Math.floor(Date.now() / 86400000);
    return quotesData[todayInt % quotesData.length];
  }, []);

  // Profil (login paytida saqlangan yoki keshdagi) bo'lsa skelet ko'rsatilmaydi
  if (!user && isLoadingUser) return <DashboardSkeleton />;

  const firstName = String(user?.name || '').trim().split(/\s+/)[0];
  const q = user?.dailyQuests || {};
  const isToday = Boolean(user?.today) && q.date === user.today;
  const topicDone = Boolean(isToday && q.topicCompleted);
  const reviewDone = Boolean(isToday && q.reviewCompleted);
  const doneCount = Number(topicDone) + Number(reviewDone);
  const allDone = doneCount === 2;
  const streak = user?.currentStreak || 0;
  const learnedCount = user?.knownWords ?? 0;
  const totalWords = user?.totalWords ?? 0;
  const course = user?.course;
  const recommended = RECOMMENDED_BY_GOAL[user?.onboarding?.goal];

  const scrollToReview = () =>
    document.getElementById('review')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Hero: bugungi reja ─────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="hero-mesh noise relative overflow-hidden rounded-[1.75rem] p-5 text-white shadow-[0_24px_60px_-24px_color-mix(in_oklch,var(--primary)_75%,transparent)] sm:p-8"
        aria-labelledby="today-title"
      >
        {/* Dekor: suzuvchi doiralar */}
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 size-64 rounded-full bg-fuchsia-400/20 blur-3xl" />

        <div className="relative grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="min-w-0">
            <p className="text-sm font-medium text-white/75">{formatToday()}</p>
            <h1 id="today-title" className="mt-1 text-[1.85rem] font-extrabold leading-[1.1] sm:text-[2.4rem]">
              {greeting()}, {firstName}
              <motion.span
                className="ml-2 inline-block origin-[70%_70%]"
                animate={{ rotate: [0, 16, -8, 14, 0] }}
                transition={{ duration: 1.4, delay: 0.6, ease: 'easeInOut' }}
                aria-hidden="true"
              >
                👋
              </motion.span>
            </h1>
            <p className="mt-2 max-w-md text-[15px] text-white/80">
              {allDone
                ? "Bugungi reja bajarildi — ajoyib! Qo'shimcha mashqlar bilan davom etishingiz mumkin."
                : doneCount === 1
                  ? 'Yana bitta qadam — va streak saqlanadi.'
                  : 'Ikki qadam: yangi sahna va takrorlash. Taxminan 15 daqiqa.'}
            </p>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <PlanStep
                done={topicDone}
                icon={BookHeart}
                title="Kunlik sahna"
                hint={topicDone ? 'Bajarildi' : 'Dialog, yangi so\'zlar, mini-test'}
                to="/topic"
              />
              <PlanStep
                done={reviewDone}
                icon={Repeat2}
                title="Takrorlash"
                hint={
                  reviewDone
                    ? 'Bajarildi'
                    : isLoadingDue
                      ? 'Yuklanmoqda…'
                      : dueWords.length
                        ? `${dueWords.length} ta so'z kutmoqda`
                        : "Navbat bo'sh"
                }
                onClick={scrollToReview}
              />
            </div>
          </div>

          <div className="hidden flex-col items-center gap-2 md:flex">
            <ProgressRing value={doneCount} max={2} size={148} stroke={12} gradientId="hero-ring">
              <span className="text-4xl font-extrabold tabular">{doneCount}/2</span>
              <span className="text-xs font-medium text-white/75">qadam</span>
            </ProgressRing>
          </div>
        </div>
      </motion.section>

      {/* ── Statistika ─────────────────────────────────────────────────── */}
      <Stagger className="grid grid-cols-2 gap-3 lg:grid-cols-4" delay={0.15}>
        <StaggerItem>
          <StatTile icon={Flame} tone="streak" value={streak} label="kunlik streak" />
        </StaggerItem>
        <StaggerItem>
          <StatTile
            icon={Snowflake}
            tone="info"
            value={user?.streakFreezesLeft ?? 0}
            label="muzlatish qoldi"
            hint="Bir kun o'tkazib yuborsangiz, streak avtomatik saqlanadi. Har oy 2 ta beriladi."
          />
        </StaggerItem>
        <StaggerItem>
          <div className="surface flex items-center gap-3 p-4">
            <IconTile icon={GraduationCap} tone="xp" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xl font-extrabold leading-none">{course?.cefr || '—'}</span>
                {course && (
                  <span className="text-xs font-bold tabular text-muted-foreground">
                    {course.done}/{course.total}
                  </span>
                )}
              </div>
              <ProgressBar
                value={course?.done || 0}
                max={course?.total || 1}
                tone="xp"
                className="mt-2 h-1.5"
                label={`${course?.cefr || ''} darajasidagi sahnalar`}
              />
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <Link to="/vocabulary" className="block rounded-[calc(var(--radius)+4px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <StatTile icon={BookOpen} tone="primary" value={learnedCount} label={`bilgan so'z · ${totalWords} lug'atda`} className="surface-interactive" />
          </Link>
        </StaggerItem>
      </Stagger>

      {/* ── Takrorlash ─────────────────────────────────────────────────── */}
      <div id="review" className="scroll-mt-24">
        <TodayHub user={user} totalWords={totalWords} />
      </div>

      {/* ── Qo'shimcha mashqlar ────────────────────────────────────────── */}
      <section aria-labelledby="practice-title">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 id="practice-title" className="text-xl font-extrabold">Qo&apos;shimcha mashqlar</h2>
            <p className="text-sm text-muted-foreground">Kunlik rejaga kirmaydi — streak'ni to&apos;smaydi.</p>
          </div>
        </div>
        <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" gap={0.05}>
          {PRACTICE_NAV.map((item) => (
            <StaggerItem key={item.to}>
              <Link
                to={item.to}
                className="surface-interactive group flex h-full items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:flex-col xl:items-start"
              >
                <IconTile icon={item.icon} tone={item.tone} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-bold">{item.label}</span>
                    {recommended === item.to && (
                      <Badge variant="soft">
                        <Sparkles /> Siz uchun
                      </Badge>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.hint}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 xl:hidden" />
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ── Kun iqtibosi ───────────────────────────────────────────────── */}
      {dailyQuote && (
        <motion.figure
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.6 }}
          className="surface relative overflow-hidden p-6 sm:p-8"
        >
          <Quote className="absolute -right-3 -top-3 size-20 rotate-180 text-primary/10" aria-hidden="true" />
          <blockquote className="relative text-lg font-semibold italic leading-relaxed sm:text-xl">
            &ldquo;{dailyQuote.text}&rdquo;
          </blockquote>
          <p className="relative mt-2 text-sm text-muted-foreground">{dailyQuote.translation}</p>
          <figcaption className="relative mt-4 text-sm font-bold text-primary">— {dailyQuote.author}</figcaption>
        </motion.figure>
      )}
    </div>
  );
};

export default Dashboard;
