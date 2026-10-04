import React from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  GraduationCap, BookOpen, BookHeart, Repeat2, Check, ArrowRight, MessagesSquare, PartyPopper,
} from 'lucide-react';
import {
  useGetReviewDueQuery, useGetMeQuery, useGetPhrasesDueQuery, useGetSpeakTodayQuery,
} from '../features/api/apiSlice';
import TodayHub from '../components/TodayHub/TodayHub';
import { SpeakCard, WeekStrip, YesterdayCard } from '../components/TodayHub/TodayCards';
import { PRACTICE_NAV } from '../components/Layout/nav';
import { IconTile, ProgressBar, ProgressRing, Skeleton, Stagger, StaggerItem, StatTile } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getDailyPlan } from '../utils/dailyPlan';
import { useDiaryEntries } from '../hooks/useDiaryEntries';
import { isStoryDue, storiesOf } from '../utils/diaryLogic';

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

const PlanStep = ({ done, icon, title, hint, minutes, to, onClick, active }) => {
  const Comp = to ? Link : 'button';
  return (
    <Comp
      to={to}
      onClick={onClick}
      type={to ? undefined : 'button'}
      className={cn(
        'group flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors',
        done ? 'bg-white/10' : active ? 'bg-white/22 ring-2 ring-white/60' : 'bg-white/12 hover:bg-white/20'
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
        <span className={cn('flex items-baseline justify-between gap-2 font-bold text-white', done && 'opacity-80')}>
          {title}
          {!done && minutes && <span className="text-[11px] font-semibold text-white/60">~{minutes} daq</span>}
        </span>
        <span className="block truncate text-xs text-white/70">{hint}</span>
      </span>
    </Comp>
  );
};

const DashboardSkeleton = () => (
  <div className="space-y-6" aria-busy="true" aria-label="Yuklanmoqda">
    <Skeleton className="h-72 rounded-3xl sm:h-64" />
    <div className="grid gap-3 lg:grid-cols-2">
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
    </div>
    <Skeleton className="h-80 rounded-3xl" />
  </div>
);

/**
 * "Bugun" — kunlik rejaning boshqaruv paneli.
 *
 * Asosiy g'oya: odam nima qilishni o'ylab o'tirmasin. Bitta katta tugma doim
 * KEYINGI qadamni ochadi (Sahna → Suhbat → Takrorlash). Ilgari sahifada
 * iqtibos, maqsad bo'yicha tavsiya va alohida streak/muzlatish plitkalari
 * bor edi — ular joy egallardi, lekin keyingi harakatni aytmasdi.
 */
const Dashboard = () => {
  const navigate = useNavigate();
  const authUser = useSelector((state) => state.auth.user);
  const { data: fetchedUser, isLoading: isLoadingUser } = useGetMeQuery();
  const user = fetchedUser || authUser;

  // Butun lug'at (/api/words — 400 so'zda ~180 KB) bu yerda YUKLANMAYDI: sonlar
  // profilda keladi (totalWords, knownWords).
  const { data: dueWords = [], isLoading: isLoadingDue } = useGetReviewDueQuery();
  const { data: duePhrases = [] } = useGetPhrasesDueQuery();
  const { data: speak } = useGetSpeakTodayQuery();
  const { entries: diary } = useDiaryEntries();
  const dueCards = dueWords.length + duePhrases.length;

  // Profil (login paytida saqlangan yoki keshdagi) bo'lsa skelet ko'rsatilmaydi
  if (!user && isLoadingUser) return <DashboardSkeleton />;

  const firstName = String(user?.name || '').trim().split(/\s+/)[0];
  const { topicDone, speakDone, reviewDone, reviewSkipped, done: doneCount, total: planTotal, allDone } =
    getDailyPlan(user);
  const learnedCount = user?.knownWords ?? 0;
  const totalWords = user?.totalWords ?? 0;
  const course = user?.course;
  const topicName = speak?.preview?.topicUz;
  const partnerName = speak?.preview?.partner?.name;

  const scrollToReview = () =>
    document.getElementById('review')?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Keyingi qadam — tartib bilan: Sahna → Suhbat → Takrorlash
  const next = !topicDone
    ? { key: 'topic', label: topicName ? `Sahnani boshlash: ${topicName}` : 'Sahnani boshlash', run: () => navigate('/topic') }
    : !speakDone
      ? { key: 'speak', label: partnerName ? `${partnerName} bilan suhbat` : 'Suhbatga o\'tish', run: () => navigate('/speak') }
      : !reviewDone && !reviewSkipped && dueCards > 0
        ? { key: 'review', label: `Takrorlash · ${dueCards} ta karta`, run: scrollToReview }
        : null;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Hero: bugungi reja va bitta "keyingi qadam" ─────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="hero-mesh noise relative overflow-hidden rounded-[1.75rem] p-5 text-white shadow-[0_24px_60px_-24px_color-mix(in_oklch,var(--primary)_75%,transparent)] sm:p-8"
        aria-labelledby="today-title"
      >
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
                ? "Bugungi reja bajarildi — ajoyib! Ertaga yangi sahna va yangi suhbatdosh."
                : `${doneCount}/${planTotal} qadam · taxminan ${planTotal === 3 ? 15 : 12} daqiqa`}
            </p>

            <div className={cn('mt-5 grid gap-2', reviewSkipped ? 'sm:grid-cols-2' : 'sm:grid-cols-3')}>
              <PlanStep
                done={topicDone}
                active={next?.key === 'topic'}
                icon={BookHeart}
                title="Sahna"
                minutes={7}
                hint={topicDone ? 'Bajarildi' : topicName || "Dialog, so'zlar, yod olish"}
                to="/topic"
              />
              <PlanStep
                done={speakDone}
                active={next?.key === 'speak'}
                icon={MessagesSquare}
                title="Suhbat"
                minutes={5}
                hint={speakDone ? 'Bajarildi' : topicDone ? `${partnerName || 'Qahramon'} kutyapti` : 'Sahnadan keyin'}
                to="/speak"
              />
              {!reviewSkipped && (
                <PlanStep
                  done={reviewDone}
                  active={next?.key === 'review'}
                  icon={Repeat2}
                  title="Takrorlash"
                  minutes={5}
                  hint={
                    reviewDone
                      ? 'Bajarildi'
                      : isLoadingDue
                        ? 'Yuklanmoqda…'
                        : dueCards
                          ? `${dueCards} ta karta kutmoqda`
                          : "Navbat bo'sh"
                  }
                  onClick={scrollToReview}
                />
              )}
            </div>

            {next ? (
              <Button
                size="xl"
                onClick={next.run}
                className="mt-5 w-full bg-white text-primary shadow-lg hover:bg-white/90 sm:w-auto"
              >
                <span className="truncate">{next.label}</span> <ArrowRight />
              </Button>
            ) : allDone ? (
              <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold">
                <PartyPopper className="size-4" /> Streak saqlandi — qo&apos;shimcha mashqlar pastda
              </p>
            ) : null}
          </div>

          <div className="hidden flex-col items-center gap-2 md:flex">
            <ProgressRing value={doneCount} max={planTotal} size={148} stroke={12} gradientId="hero-ring">
              <span className="text-4xl font-extrabold tabular">{doneCount}/{planTotal}</span>
              <span className="text-xs font-medium text-white/75">qadam</span>
            </ProgressRing>
          </div>
        </div>
      </motion.section>

      {/* ── Bugungi suhbat va oxirgi suhbat xatolari ───────────────────── */}
      {(speak?.preview || speak?.recent) && (
        <div className={cn('grid gap-3', speak?.recent && speak?.preview && 'lg:grid-cols-2')}>
          <SpeakCard speak={speak} />
          <YesterdayCard recent={speak?.recent} />
        </div>
      )}

      {/* ── Hafta, daraja, lug'at ──────────────────────────────────────── */}
      <Stagger className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr]" delay={0.15}>
        <StaggerItem>
          <WeekStrip week={user?.week || []} streak={user?.currentStreak || 0} freezes={user?.streakFreezesLeft ?? 0} />
        </StaggerItem>
        <StaggerItem>
          <div className="surface flex h-full items-center gap-3 p-4">
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
              {course?.nextCefr && !course.finished && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {course.nextCefr} gacha {course.total - course.done} ta sahna
                </p>
              )}
            </div>
          </div>
        </StaggerItem>
        <StaggerItem>
          <Link to="/vocabulary" className="block h-full rounded-[calc(var(--radius)+4px)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <StatTile icon={BookOpen} tone="primary" value={learnedCount} label={`bilgan so'z · ${totalWords} lug'atda`} className="surface-interactive h-full" />
          </Link>
        </StaggerItem>
      </Stagger>

      {/* ── Takrorlash ─────────────────────────────────────────────────── */}
      <div id="review" className="scroll-mt-24">
        <TodayHub key={user?.today || 'today'} user={user} totalWords={totalWords} />
      </div>

      {/* ── Qo'shimcha mashqlar ────────────────────────────────────────── */}
      <section aria-labelledby="practice-title">
        <div className="mb-4">
          <h2 id="practice-title" className="text-xl font-extrabold">Bonus mashq</h2>
          <p className="text-sm text-muted-foreground">Kunlik rejaga kirmaydi — streak&apos;ni to&apos;smaydi.</p>
        </div>
        {/* Ovoz kundaligi: hikoya vaqti kelganda eslatamiz (har 7 kunda) */}
        {diary && user?.today && isStoryDue(diary, user.today) && (
          <Link
            to="/diary"
            className="surface-interactive mb-3 flex items-center gap-3 border-pink-500/25 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="text-2xl" aria-hidden="true">🎙️</span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">
                {storiesOf(diary).length ? "7 kun o'tdi — yangi hikoya vaqti" : "Ovoz kundaligini boshlang"}
              </span>
              <span className="block text-xs text-muted-foreground">
                30 soniya o&apos;zingiz haqingizda. Bir oydan keyin 1-kundagi ovozingiz bilan solishtirasiz.
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        )}
        <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-2" gap={0.05}>
          {PRACTICE_NAV.map((item) => (
            <StaggerItem key={item.to}>
              <Link
                to={item.to}
                className="surface-interactive group flex h-full items-center gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <IconTile icon={item.icon} tone={item.tone} />
                <span className="min-w-0 flex-1">
                  <span className="font-bold">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.hint}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </section>
    </div>
  );
};

export default Dashboard;
