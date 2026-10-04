import React from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowRight, Check, Flame, Lock, MessagesSquare, Snowflake, Volume2, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { playTTSAudio } from '../../utils/audio';

/**
 * Hafta tasmasi — streak va muzlatish bitta joyda, kunlar bilan.
 *
 * Ilgari "kunlik streak" va "streak muzlatish" ikki alohida plitka edi:
 * raqam ko'rinardi, lekin qaysi kun bajarilgani, qaysi biri muzlatilgani
 * ko'rinmasdi — streak abstrakt son bo'lib qolardi.
 */
export const WeekStrip = ({ week = [], streak = 0, freezes = 0 }) => (
  <div className="surface p-4 sm:p-5">
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex size-9 items-center justify-center rounded-xl',
            streak > 0 ? 'bg-streak/15 text-streak' : 'bg-muted text-muted-foreground'
          )}
        >
          <Flame className={cn('size-5', streak > 0 && 'animate-flame')} />
        </span>
        <div>
          <p className="text-lg font-extrabold leading-none tabular">{streak} kun</p>
          <p className="text-xs text-muted-foreground">ketma-ket</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() =>
          toast(
            "Streak muzlatish: bir kun o'tkazib yuborsangiz, ketma-ketlik uzilmaydi — bitta muzlatish avtomatik sarflanadi. Har oy boshida 2 taga tiklanadi.",
            { icon: '🧊', duration: 6000 }
          )
        }
        className="inline-flex items-center gap-1.5 rounded-full bg-info/10 px-3 py-1.5 text-xs font-semibold text-info"
        aria-label="Streak muzlatish nima?"
      >
        <Snowflake className="size-3.5" /> {freezes} muzlatish
      </button>
    </div>
    <ol className="grid grid-cols-7 gap-1.5" aria-label="Oxirgi 7 kun">
      {week.map((d) => (
        <li key={d.day} className="flex flex-col items-center gap-1">
          <span
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-full text-xs font-bold transition-colors',
              d.status === 'active' && 'bg-primary/15 text-primary ring-1 ring-primary/30',
              d.status === 'done' && 'bg-streak text-white',
              d.status === 'frozen' && 'bg-info/15 text-info',
              d.status === 'today' && 'border-2 border-dashed border-primary text-primary',
              d.status === 'missed' && 'bg-muted text-muted-foreground',
              d.status === 'none' && 'bg-muted/40 text-muted-foreground/40'
            )}
            title={
              { active: 'Mashq qilingan · reja hali tugamagan', done: 'Reja bajarilgan', frozen: 'Muzlatish ishlatilgan', today: 'Bugun', missed: "O'tkazib yuborilgan", none: '' }[
                d.status
              ]
            }
          >
            {d.status === 'done' ? <Check className="size-4" strokeWidth={3} /> : d.status === 'frozen' ? <Snowflake className="size-4" /> : Number(d.day.slice(-2))}
          </span>
          <span className={cn('text-[11px] font-semibold', d.status === 'today' || d.status === 'active' ? 'text-primary' : 'text-muted-foreground')}>
            {d.weekday}
          </span>
        </li>
      ))}
    </ol>
    <p className="mt-3 text-[11px] text-muted-foreground">Rangli sana — mashq qilingan · ✓ — kunlik reja bajarilgan</p>
  </div>
);

/**
 * "Bugungi suhbat" — qahramon va bugungi so'zlar oldindan ko'rinadi.
 * Odam sahnani boshlashdan oldin ham kimni kutayotganini biladi.
 */
export const SpeakCard = ({ speak }) => {
  const preview = speak?.preview;
  if (!preview) return null;
  const done = speak.speakCompleted;
  const conv = speak.conversation;
  return (
    <Link
      to="/speak"
      className="surface-interactive group relative flex h-full flex-col overflow-hidden p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-fuchsia-500/10 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-fuchsia-500/20 text-2xl ring-1 ring-primary/20" aria-hidden="true">
          {preview.partner.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
            <MessagesSquare className="size-3.5" /> Bugungi suhbat
          </p>
          <p className="truncate text-lg font-extrabold">{preview.partner.name}</p>
        </div>
        {done ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2.5 py-1 text-xs font-bold text-success">
            <Check className="size-3.5" /> Bajarildi
          </span>
        ) : !speak.sceneDone ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            <Lock className="size-3.5" /> Sahnadan keyin
          </span>
        ) : (
          <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        )}
      </div>
      <p className="relative mt-3 line-clamp-2 text-sm text-muted-foreground">{preview.situationUz}</p>
      <div className="relative mt-auto flex flex-wrap gap-1.5 pt-4">
        {preview.targetWords.slice(0, 5).map((w) => {
          const used = conv?.targetWords?.find((t) => t.word === w.word)?.used;
          return (
            <span
              key={w.word}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-semibold',
                used ? 'border-success/40 bg-success/12 text-success' : 'border-border bg-card text-muted-foreground'
              )}
            >
              {w.word}
            </span>
          );
        })}
      </div>
    </Link>
  );
};

/**
 * "Kechagi suhbatdan" — xato kecha qolib ketmasin: to'g'ri variant bugun
 * yana ko'z oldida, bir bosishda eshitiladi.
 */
export const YesterdayCard = ({ recent }) => {
  if (!recent?.corrections?.length) return null;
  return (
    <div className="surface flex h-full flex-col p-5">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
        <Wand2 className="size-3.5" /> Oxirgi suhbatdan
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {recent.partner?.emoji} {recent.partner?.name} bilan · {recent.topicUz}
      </p>
      <ul className="mt-3 space-y-2.5">
        {recent.corrections.map((c, i) => (
          <li key={i} className="rounded-2xl border border-border p-3">
            <p className="text-sm text-muted-foreground line-through decoration-destructive/60">{c.said}</p>
            <div className="mt-0.5 flex items-start justify-between gap-2">
              <p className="font-semibold text-success">{c.better}</p>
              <button
                type="button"
                onClick={() => playTTSAudio(c.better, 'en-GB', 0.85)}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                aria-label="To'g'ri variantni eshitish"
              >
                <Volume2 className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
