import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Brain, BookOpen, Mic, CheckCircle2, Circle, Lock, ArrowRight, Clock, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDailyWordTarget, xpProgressInLevel } from '../../utils/learningUtils';
import { fireConfetti } from '../../utils/celebration';
import { track, EVENTS } from '../../lib/analytics';

const STEPS = [
  {
    id: 'topic',
    questKey: 'topicCompleted',
    path: '/topic',
    title: '1. Kunlik sahna',
    description: 'Bugungi sahna va so\'zlarni o\'rganing, testdan o\'ting.',
    duration: '5 daqiqa',
    icon: BookOpen,
    color: 'purple',
  },
  {
    id: 'review',
    questKey: 'reviewCompleted',
    path: '/review',
    title: '2. Takrorlash',
    description: 'Kunlik sahnadan so\'zlarni jumlada takrorlang.',
    duration: '3–5 daqiqa',
    icon: Brain,
    color: 'primary',
  },
  {
    id: 'immersion',
    questKey: 'immersionCompleted',
    path: '/practice',
    title: '3. Amaliyot',
    description: 'Bugun, kecha va avvalgi kunlardagi so\'zlardan gap tuzing — AI tekshiradi.',
    duration: '5–7 daqiqa',
    icon: Mic,
    color: 'teal',
  },
];

const TodayHub = ({ user, reviewDueCount = 0, totalWords = 0 }) => {
  const today = new Date().toISOString().split('T')[0];
  const quests = user?.dailyQuests || {};
  const isToday = quests.date === today;
  const wordTarget = user?.dailyWordTarget ?? getDailyWordTarget(user?.onboarding?.level);
  const level = user?.level ?? 1;
  const xpProgress = user?.xpProgress ?? xpProgressInLevel(user?.xp || 0);
  const celebratedRef = useRef(false);

  const completed = {
    review: isToday && quests.reviewCompleted,
    topic: isToday && quests.topicCompleted,
    immersion: isToday && quests.immersionCompleted,
  };

  const completedCount = Object.values(completed).filter(Boolean).length;
  const progressPercent = (completedCount / 3) * 100;

  const nextStepIndex = STEPS.findIndex((s) => !completed[s.id]);
  const allDone = nextStepIndex === -1;

  useEffect(() => {
    if (allDone && !celebratedRef.current) {
      celebratedRef.current = true;
      fireConfetti(1500);
      // Retention'ning asosiy ko'rsatkichi — kunlik reja to'liq bajarilgani
      track(EVENTS.DAILY_PLAN_COMPLETED, {
        streak: user?.currentStreak,
        level: user?.level,
        totalWords,
      });
    }
    if (!allDone) celebratedRef.current = false;
  }, [allDone, user?.currentStreak, user?.level, totalWords]);

  const coachMessage = () => {
    if (allDone) return 'Ajoyib! Bugungi reja to\'liq bajarildi. Ertaga yana ko\'ramiz!';
    if (nextStepIndex === 0) {
      return `Birinchi qadam: bugungi mavzudan ${wordTarget} ta so'z o'rganing.`;
    }
    if (nextStepIndex === 1) {
      if (totalWords === 0) return 'Avval yangi so\'z qo\'shing, keyin takrorlash mumkin bo\'ladi.';
      if (reviewDueCount > 0) return `${reviewDueCount} ta so'z takrorlashni kutmoqda.`;
      return 'Takrorlash uchun so\'zlar tayyor. Ikkinchi qadamdan boshlang.';
    }
    return "Oxirgi qadam: yodlangan so'zlardan jumlada amaliyot qiling.";
  };

  return (
    <section className="bg-card border border-border rounded-3xl shadow-sm p-4 sm:p-6 md:p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 mb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Bugungi reja</p>
        <h2 className="text-2xl md:text-3xl font-black">Qadamba-qadam o'rganish</h2>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">{coachMessage()}</p>
      </div>

      <div className="relative z-10 mb-6 p-4 rounded-2xl bg-secondary/50 border border-border">
        <div className="flex items-center justify-between text-sm font-bold mb-2">
          <span className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500" /> Daraja {level}
          </span>
          <span className="text-muted-foreground">
            {xpProgress.current}/{xpProgress.needed} XP
          </span>
        </div>
        <div className="w-full bg-background rounded-full h-2">
          <div
            className="h-full bg-yellow-500 rounded-full transition-all duration-500"
            style={{ width: `${xpProgress.percent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Keyingi darajaga {xpProgress.xpToNext} XP qoldi
        </p>
      </div>

      <div className="w-full bg-secondary rounded-full h-2 mb-8 relative z-10">
        <div
          className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-700 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="space-y-4 relative z-10">
        {STEPS.map((step, index) => {
          const done = completed[step.id];
          const reviewBlocked = step.id === 'review' && totalWords === 0 && !done;
          const locked = (nextStepIndex !== -1 && index > nextStepIndex) || reviewBlocked;
          const isNext = index === nextStepIndex && !reviewBlocked;
          const Icon = step.icon;

          const content = (
            <div
              className={cn(
                'p-5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center gap-4',
                done && 'border-green-500/50 bg-green-500/5',
                isNext && !done && 'border-primary shadow-md shadow-primary/10 bg-primary/5',
                locked && 'opacity-50 border-border bg-muted/30 cursor-not-allowed',
                !done && !locked && !isNext && 'border-border bg-background'
              )}
            >
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                  done ? 'bg-green-500/20 text-green-500' : isNext ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                )}
              >
                {locked ? <Lock className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
              </div>

              <div className="flex-grow min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold">{step.title}</h3>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {step.duration}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                {step.id === 'topic' && !done && (
                  <span className="text-xs font-bold text-purple-500 mt-2 inline-block">
                    Maqsad: {wordTarget} ta so'z
                  </span>
                )}
                {step.id === 'review' && reviewDueCount > 0 && !done && !reviewBlocked && (
                  <span className="text-xs font-bold text-destructive mt-2 inline-block">
                    {reviewDueCount} ta so'z kutmoqda
                  </span>
                )}
                {reviewBlocked && (
                  <span className="text-xs font-bold text-muted-foreground mt-2 inline-block">
                    Avval yangi so'z o'rganing
                  </span>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {done ? (
                  <CheckCircle2 className="w-7 h-7 text-green-500" />
                ) : locked ? (
                  <Circle className="w-7 h-7 text-muted-foreground/30" />
                ) : isNext ? (
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                    Boshlash <ArrowRight className="w-4 h-4" />
                  </span>
                ) : (
                  <Circle className="w-7 h-7 text-muted-foreground/30" />
                )}
              </div>
            </div>
          );

          if (locked) {
            return <div key={step.id}>{content}</div>;
          }

          return (
            <Link key={step.id} to={step.path} className="block group">
              {content}
            </Link>
          );
        })}
      </div>

      {allDone && (
        <p className="mt-6 text-center text-sm font-bold text-green-500 relative z-10">
          Kunlik reja 100% bajarildi — streak va XP yangilandi!
        </p>
      )}
    </section>
  );
};

export default TodayHub;
