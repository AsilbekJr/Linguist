import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion, useAnimationControls } from 'motion/react';
import { ArrowRight, Check, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { playTTSAudio } from '../utils/audio';

const SOURCE_LABEL = { topic: 'bugungi mavzu', course: 'kursdan', library: 'kutubxonadan', own: "so'z misoli" };

const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * "Sizning so'zlaringiz" — lug'atdagi so'zlar bugungi mavzu (yoki kurs)
 * gaplarida. Foydalanuvchi bo'sh joyga bankdan mos so'zni qo'yadi.
 *
 * Maqsad — faol ishlatish: so'z takrorlash kartochkasidan tashqarida, yangi
 * kontekstda uchraydi. Mashq, SRS jadvaliga tegmaydi; xato jazolanmaydi —
 * to'g'risini topguncha urinish mumkin.
 */
const ActiveWords = ({ items, onDone, doneLabel = 'Yakunlash' }) => {
  const bank = useMemo(() => shuffle(items.map((i) => i.answer)), [items]);
  const [solved, setSolved] = useState({}); // item index → true
  const [current, setCurrent] = useState(0);
  const [wrong, setWrong] = useState(null); // noto'g'ri bosilgan bank so'zi
  const [mistakes, setMistakes] = useState(0);
  const shake = useAnimationControls();

  const solvedCount = Object.keys(solved).length;
  const allDone = solvedCount === items.length;

  const pick = (answer) => {
    if (allDone) return;
    const item = items[current];
    if (answer.toLowerCase() === item.answer.toLowerCase()) {
      const next = { ...solved, [current]: true };
      setSolved(next);
      setWrong(null);
      playTTSAudio(item.sentence.replace('_____', item.answer), 'en-GB', 0.9);
      const nextIdx = items.findIndex((_, i) => !next[i]);
      if (nextIdx >= 0) setCurrent(nextIdx);
    } else {
      setWrong(answer);
      setMistakes((m) => m + 1);
      shake.start({ x: [0, -8, 8, -5, 5, 0], transition: { duration: 0.35 } });
    }
  };

  const usedAnswers = new Set(items.filter((_, i) => solved[i]).map((i) => i.answer));

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <ProgressBar value={solvedCount} max={items.length} className="h-2 flex-1" label="Faol so'zlar jarayoni" />
        <span className="text-sm font-bold tabular">
          {solvedCount}
          <span className="text-muted-foreground">/{items.length}</span>
        </span>
      </div>

      <h2 className="text-xl font-extrabold">Sizning so&apos;zlaringiz</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Lug&apos;atingizdagi so&apos;zlar — yangi gaplarda. Belgilangan gapdagi bo&apos;sh joyga mos so&apos;zni pastdan tanlang.
      </p>

      <ol className="mt-5 space-y-3">
        {items.map((item, i) => {
          const done = solved[i];
          const active = i === current && !done;
          const [before, after] = item.sentence.split('_____');
          return (
            <motion.li
              key={item.id}
              animate={active ? shake : undefined}
              onClick={() => !done && setCurrent(i)}
              className={cn(
                'rounded-2xl border p-4 transition-colors',
                done ? 'border-success/30 bg-success/5' : active ? 'border-primary/50 bg-primary/5 ring-4 ring-primary/10' : 'cursor-pointer border-border bg-card'
              )}
            >
              <div className="flex items-start gap-3">
                <p className="min-w-0 flex-1 text-[17px] font-semibold leading-relaxed">
                  {before}
                  <span
                    className={cn(
                      'mx-0.5 inline-block min-w-16 rounded-lg px-2 text-center',
                      done ? 'bg-success/15 text-success' : active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {done ? item.answer : '?'}
                  </span>
                  {after}
                </p>
                {done && (
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="shrink-0 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      playTTSAudio(item.sentence.replace('_____', item.answer), 'en-GB', 0.9);
                    }}
                    aria-label="Gapni eshitish"
                  >
                    <Volume2 />
                  </Button>
                )}
              </div>
              {item.sentenceUz && <p className="mt-1 text-sm text-muted-foreground">{item.sentenceUz}</p>}
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground/80">
                {done ? `${item.answer} — ${item.translation}` : SOURCE_LABEL[item.source] || ''}
              </p>
            </motion.li>
          );
        })}
      </ol>

      <AnimatePresence mode="wait">
        {!allDone ? (
          <motion.div key="bank" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-5">
            <p className="mb-2 text-sm font-bold">So&apos;zlar banki</p>
            <div className="flex flex-wrap gap-2">
              {bank.map((answer) => {
                const used = usedAnswers.has(answer);
                return (
                  <button
                    key={answer}
                    type="button"
                    disabled={used}
                    onClick={() => pick(answer)}
                    className={cn(
                      'rounded-xl border px-3 py-1.5 text-base font-semibold transition-[opacity,transform,border-color] active:scale-95',
                      used
                        ? 'border-dashed border-border text-muted-foreground/40 line-through'
                        : wrong === answer
                          ? 'border-destructive/60 bg-destructive/8 text-destructive'
                          : 'border-border bg-card hover:border-primary/50'
                    )}
                  >
                    {answer}
                  </button>
                );
              })}
            </div>
            {wrong && <p className="mt-2 text-sm text-destructive">Bu gapga mos emas — yana urinib ko&apos;ring.</p>}
          </motion.div>
        ) : (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-success/30 bg-success/8 p-4"
          >
            <p className="flex items-center gap-2 font-bold text-success">
              <Check className="size-5" strokeWidth={3} />
              {mistakes === 0 ? "Hammasi birinchi urinishda to'g'ri!" : `Bajarildi · ${mistakes} ta xato`}
            </p>
            <Button size="lg" onClick={() => onDone?.({ total: items.length, mistakes })}>
              {doneLabel} <ArrowRight />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ActiveWords;
