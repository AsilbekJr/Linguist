import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Brain, Check, Eye, Info, Mic, MicOff, RotateCcw, Sparkles, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { playTTSAudio } from '../utils/audio';
import { matchSpeech, PASS_PERCENT } from '../utils/speechMatch';
import { maskLine, ROUNDS, MANDATORY_ROUNDS, LAST_ROUND } from '../utils/memorize';

const EASE = [0.16, 1, 0.3, 1];

/** Aytilgan so'zlar yashil, tushib qolganlari qizil chiziqli */
const MatchedLine = ({ words }) => (
  <p className="text-lg font-semibold leading-relaxed">
    {words.map((w, i) => (
      <React.Fragment key={i}>
        <span className={w.hit ? 'text-success' : 'text-destructive underline decoration-2 underline-offset-4'}>{w.text}</span>{' '}
      </React.Fragment>
    ))}
  </p>
);

const MaskedLine = ({ parts }) => (
  <p className="text-lg font-semibold leading-relaxed tracking-wide">
    {parts.map((p, i) => (
      <React.Fragment key={i}>
        {/* Faqat chiziqchalar ajratiladi — tinish belgisi va birinchi harf odatdagidek */}
        {p.hidden
          ? p.text.split(/(_+)/).map((chunk, j) =>
              chunk.startsWith('_') ? (
                <span key={j} className="font-mono text-primary/70">{chunk}</span>
              ) : (
                <React.Fragment key={j}>{chunk}</React.Fragment>
              )
            )
          : p.text}{' '}
      </React.Fragment>
    ))}
  </p>
);

/**
 * "Yod olish" — kunning kalit gaplarini qo'shiq matni kabi yodlash.
 *
 * Sahnaning gapirish qadami. Ilgari bu yerda butun dialog bir marta eshitib
 * takrorlanardi va hech narsa yodda qolmasdi. Endi 4-5 ta kalit gap davrama-
 * davra yashirilib boradi (utils/memorize.js): 1-2-davralar majburiy, 3-4 —
 * "yoddan" — ixtiyoriy. Davrada o'tolmagan gap shu davra oxirida bir marta
 * qaytadan chiqadi.
 *
 * Ovoz brauzerning o'zida matnga aylantiriladi va mahalliy solishtiriladi —
 * AI chaqirilmaydi, audio hech qayerga yuborilmaydi.
 */
const Memorize = ({ lines = [], targets = [], startRound = 1, onMandatoryDone, onDone }) => {
  const [round, setRound] = useState(startRound);
  const [queue, setQueue] = useState(() => lines.map((_, i) => ({ i, retry: false })));
  const [pos, setPos] = useState(0);
  const [attempt, setAttempt] = useState(null); // { spoken, match }
  const [peek, setPeek] = useState(false);
  const [typed, setTyped] = useState('');
  const [passedByRound, setPassedByRound] = useState({}); // round → Set(lineIndex)
  const [summary, setSummary] = useState(null); // davra tugagach

  const item = queue[pos];
  const line = item ? lines[item.i] : null;
  const meta = ROUNDS[round - 1];
  const parts = useMemo(() => (line ? maskLine(line.en, round, targets) : []), [line, round, targets]);

  const speech = useSpeechInput({
    lang: 'en-US',
    onResult: (text) => setAttempt({ spoken: text, match: matchSpeech(line?.en, text) }),
  });

  // 1-davrada gap o'zi eshittiriladi; keyingi davralarda — faqat so'ralsa (javobni ochib qo'ymasin)
  useEffect(() => {
    if (line && round === 1 && !summary) playTTSAudio(line.en, 'en-GB', 0.9);
  }, [line, round, summary]);

  const passed = attempt && attempt.match.percent >= PASS_PERCENT;

  const resetLine = () => {
    speech.stop();
    setAttempt(null);
    setPeek(false);
    setTyped('');
  };

  const next = () => {
    const ok = attempt ? attempt.match.percent >= PASS_PERCENT : true;
    let nextQueue = queue;
    // Hisob lokal yuritiladi: state yangilanishi davra yakunida hali ko'rinmaydi
    const passedSet = new Set(passedByRound[round] || []);
    // Ovozsiz brauzerda 1-davra — "Takrorladim" ham o'tgan hisoblanadi
    if ((attempt && ok) || (!attempt && !speech.supported && round === 1)) passedSet.add(item.i);
    setPassedByRound((m) => ({ ...m, [round]: passedSet }));
    // O'tolmagan gap — davra oxirida bir marta qaytadan
    if (attempt && !ok && !item.retry) nextQueue = [...queue, { i: item.i, retry: true }];
    resetLine();
    if (pos + 1 >= nextQueue.length) {
      setSummary({ round, passed: passedSet.size, total: lines.length });
      setQueue(nextQueue);
      setPos(0);
      return;
    }
    setQueue(nextQueue);
    setPos((p) => p + 1);
  };

  const startRoundN = (n) => {
    setSummary(null);
    setRound(n);
    setQueue(lines.map((_, i) => ({ i, retry: false })));
    setPos(0);
  };

  const checkTyped = (e) => {
    e.preventDefault();
    if (typed.trim()) setAttempt({ spoken: typed.trim(), match: matchSpeech(line.en, typed) });
  };

  if (!lines.length) return null;

  // ─── Davra natijasi ───────────────────────────────────────────────────────
  if (summary) {
    const mandatoryJustDone = summary.round === MANDATORY_ROUNDS && startRound <= MANDATORY_ROUNDS;
    const allDone = summary.round >= LAST_ROUND;
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE }} className="text-center">
        <span className="mx-auto mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {allDone ? <Sparkles className="size-8" /> : <Brain className="size-8" />}
        </span>
        <h2 className="text-xl font-extrabold">
          {allDone ? 'Yoddan aytdingiz!' : `${summary.round}-davra tugadi`}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          {summary.passed}/{summary.total} gap to&apos;g&apos;ri aytildi.{' '}
          {mandatoryJustDone
            ? "Majburiy qism tugadi. Xohlasangiz, gaplarni endi yoddan aytib ko'ring — shunda ular haqiqatan esda qoladi."
            : allDone
              ? "Bu gaplar endi sizniki — suhbatda ularni bemalol ishlatasiz."
              : 'Keyingi davrada matn yanada kamayadi.'}
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {mandatoryJustDone ? (
            <>
              <Button size="lg" variant="brand" onClick={() => onMandatoryDone?.(summary)}>
                Davom etish <ArrowRight />
              </Button>
              <Button size="lg" variant="outline" onClick={() => startRoundN(summary.round + 1)}>
                <Brain /> Yoddan aytib ko&apos;rish
              </Button>
            </>
          ) : allDone ? (
            <Button size="lg" variant="brand" onClick={() => onDone?.(summary)}>
              Tayyor <Check />
            </Button>
          ) : (
            <Button size="lg" variant="brand" onClick={() => startRoundN(summary.round + 1)}>
              {summary.round + 1}-davra <ArrowRight />
            </Button>
          )}
        </div>
      </motion.div>
    );
  }

  // ─── Gap ──────────────────────────────────────────────────────────────────
  const showFull = round === 1 || peek;
  const mandatory = round <= MANDATORY_ROUNDS;

  return (
    <div>
      {/* Davralar: 2 tasi majburiy, qolganlari ixtiyoriy */}
      <div className="mb-4 flex items-center gap-1.5" aria-label="Davralar">
        {ROUNDS.map((r) => (
          <span
            key={r.round}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-500',
              r.round < round ? 'bg-success' : r.round === round ? 'bg-primary' : 'bg-muted',
              r.round > MANDATORY_ROUNDS && r.round !== round && 'opacity-50'
            )}
          />
        ))}
      </div>
      <div className="mb-5 flex items-center gap-3">
        <ProgressBar value={pos} max={queue.length} className="h-2 flex-1" label="Davra jarayoni" />
        <span className="text-sm font-bold tabular">
          {pos + 1}
          <span className="text-muted-foreground">/{queue.length}</span>
        </span>
      </div>

      <p className="text-sm font-semibold text-muted-foreground">
        {round}-davra · {meta.title}
        {!mandatory && <span className="ml-1 text-xs font-medium">(ixtiyoriy)</span>}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{meta.hint}</p>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${round}-${pos}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="mt-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {line.speaker}
              {item.retry && <span className="ml-1 normal-case text-warning">· yana bir bor</span>}
            </p>
            {(showFull || attempt) && (
              <Button
                variant="outline"
                size="icon-sm"
                className="shrink-0 rounded-full"
                onClick={() => playTTSAudio(line.en, 'en-GB', 0.85)}
                aria-label="Gapni eshitish"
              >
                <Volume2 />
              </Button>
            )}
          </div>

          {attempt ? (
            <MatchedLine words={attempt.match.words} />
          ) : showFull ? (
            <p className="text-lg font-semibold leading-relaxed">{line.en}</p>
          ) : round >= LAST_ROUND ? (
            <p className="text-lg font-semibold leading-relaxed text-muted-foreground/70">• • •</p>
          ) : (
            <MaskedLine parts={parts} />
          )}
          <p className="mt-1 text-sm text-muted-foreground">{line.uz}</p>
        </motion.div>
      </AnimatePresence>

      <div className="mt-5 space-y-4">
        {attempt && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('rounded-2xl border px-4 py-3 text-sm', passed ? 'border-success/30 bg-success/8' : 'border-warning/35 bg-warning/10')}
          >
            <p className="font-bold">
              {passed ? "Zo'r!" : "Yana bir bor urinib ko'ring"} · <span className="tabular">{attempt.match.percent}%</span>
            </p>
            <p className="mt-0.5 text-muted-foreground">Brauzer eshitgani: &ldquo;{attempt.spoken}&rdquo;</p>
          </motion.div>
        )}

        {speech.supported ? (
          <div className="flex flex-wrap items-center gap-2">
            {!attempt ? (
              <Button size="lg" variant={speech.listening ? 'destructive' : 'brand'} onClick={speech.toggle} className="flex-1 sm:flex-none">
                {speech.listening ? <MicOff /> : <Mic />}
                {speech.listening ? "To'xtatish" : 'Aytish'}
              </Button>
            ) : (
              <Button size="lg" variant="outline" onClick={() => { setAttempt(null); speech.start(); }}>
                <RotateCcw /> Qayta aytish
              </Button>
            )}
            {!showFull && !attempt && (
              <Button variant="ghost" onClick={() => setPeek(true)}>
                <Eye /> Ko&apos;rsatish
              </Button>
            )}
            {/* Majburiy davralarda gapni hech bo'lmasa bir marta aytish shart */}
            <Button
              size="lg"
              variant={attempt ? 'default' : 'ghost'}
              className="ml-auto"
              onClick={next}
              disabled={mandatory && !attempt}
            >
              {attempt ? 'Keyingi' : "O'tkazib yuborish"} {attempt && <ArrowRight />}
            </Button>
          </div>
        ) : (
          // Ovoz tanilmaydigan brauzer: 1-davra — ovoz chiqarib takrorlash, keyingilari — yozib tekshirish
          <div className="space-y-3">
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              Bu brauzer ovozni tanimaydi. {round === 1 ? 'Gapni tinglab, ovoz chiqarib takrorlang.' : 'Gapni ovoz chiqarib ayting, keyin yozib tekshiring.'}
            </p>
            {round > 1 && !attempt && (
              <form onSubmit={checkTyped} className="flex gap-2">
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
                  placeholder="Inglizcha gap…"
                  aria-label="Inglizcha gap"
                  autoComplete="off"
                  autoCapitalize="none"
                />
                <Button type="submit" disabled={!typed.trim()}>
                  <Check /> Tekshirish
                </Button>
              </form>
            )}
            <div className="flex justify-end">
              <Button size="lg" onClick={next} disabled={round > 1 && mandatory && !attempt}>
                {round === 1 ? 'Takrorladim' : 'Keyingi'} <ArrowRight />
              </Button>
            </div>
          </div>
        )}

        {speech.listening && speech.interim && <p className="text-sm italic text-muted-foreground">&ldquo;{speech.interim}&rdquo;</p>}
        {speech.error && <p className="text-sm text-destructive">{speech.error}</p>}
      </div>

      <p className="mt-6 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Bu talaffuz bahosi emas: brauzer tanigan matn gap bilan solishtiriladi. Ovozingiz hech qayerga yuborilmaydi.
      </p>
    </div>
  );
};

export default Memorize;
