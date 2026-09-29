import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Check, Eye, Info, Mic, MicOff, RotateCcw, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { playTTSAudio } from '../utils/audio';
import { matchSpeech, PASS_PERCENT } from '../utils/speechMatch';

const EASE = [0.16, 1, 0.3, 1];

const COPY = {
  shadow: {
    title: 'Eshiting va takrorlang',
    hint: "Har bir qatorni tinglab, xuddi shunday ohangda ovoz chiqarib ayting.",
  },
  recall: {
    title: 'Dialogni yoddan ayting',
    hint: "Suhbatdoshingiz qatorlari eshittiriladi. Sizning qatoringiz — faqat o'zbekcha; uni inglizcha yoddan ayting.",
  },
};

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

/**
 * Kunlik sahna dialogi bilan gapirish mashqi.
 *
 *  - `shadow` — har bir qatorni eshitib takrorlash (sahnaning qadami);
 *  - `recall` — rol tanlab, o'z qatorlarini yoddan aytish (ixtiyoriy, yakunda).
 *
 * Ilgari buning o'rnida ikkita alohida sahifa bor edi: "Gapirish" (AI bilan
 * erkin tarjima) va "100 kunlik challenge" (audio bazaga base64 bo'lib
 * yozilardi). Ikkalasi ham kunlik sahnadan uzilgan edi. Endi gapirish aynan
 * bugun o'rganilgan dialog ustida bo'ladi, solishtirish brauzerning o'zida,
 * audio hech qayerga yuborilmaydi.
 */
const DialoguePractice = ({ dialogue = [], mode = 'shadow', onDone, doneLabel = 'Yakunlash' }) => {
  const speakers = useMemo(() => [...new Set(dialogue.map((l) => l.speaker))], [dialogue]);
  const [role, setRole] = useState(mode === 'recall' ? null : undefined);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState({}); // idx → percent
  const [attempt, setAttempt] = useState(null); // { spoken, match }
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState('');

  // recall: foydalanuvchi faqat o'z qatorlarini aytadi; boshqalarini tinglaydi
  const isMine = (line) => mode === 'shadow' || line.speaker === role;
  const line = dialogue[idx];
  const mine = line ? isMine(line) : false;
  const last = idx >= dialogue.length - 1;

  const speech = useSpeechInput({
    lang: 'en-US',
    onResult: (text) => setAttempt({ spoken: text, match: matchSpeech(line?.en, text) }),
  });

  // Yangi qatorga o'tganda: suhbatdosh qatori yoki shadow qatori o'zi eshittiriladi
  useEffect(() => {
    if (!line || (mode === 'recall' && !role)) return;
    if (mode === 'shadow' || !mine) playTTSAudio(line.en, 'en-GB', 0.9);
  }, [idx, role]); // eslint-disable-line react-hooks/exhaustive-deps

  // Natijani saqlaymiz — oxirida o'rtacha ko'rsatiladi
  useEffect(() => {
    if (attempt) setResults((r) => ({ ...r, [idx]: attempt.match.percent }));
  }, [attempt, idx]);

  const next = () => {
    speech.stop();
    setAttempt(null);
    setRevealed(false);
    setTyped('');
    if (last) {
      const scores = Object.values(results);
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      onDone?.({ average: avg, attempted: scores.length });
      return;
    }
    setIdx((i) => i + 1);
  };

  const retry = () => {
    setAttempt(null);
    speech.start();
  };

  const checkTyped = (e) => {
    e.preventDefault();
    if (typed.trim()) setAttempt({ spoken: typed.trim(), match: matchSpeech(line.en, typed) });
  };

  if (!dialogue.length) return null;

  // Rol tanlash (faqat recall)
  if (mode === 'recall' && !role) {
    return (
      <div>
        <h2 className="text-xl font-extrabold">{COPY.recall.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{COPY.recall.hint}</p>
        <p className="mt-5 text-sm font-bold">Kim bo&apos;lasiz?</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {speakers.map((s) => (
            <Button key={s} variant="outline" size="lg" className="justify-start" onClick={() => setRole(s)}>
              {s}
              <span className="ml-auto text-xs text-muted-foreground">
                {dialogue.filter((l) => l.speaker === s).length} ta qator
              </span>
            </Button>
          ))}
        </div>
      </div>
    );
  }

  const passed = attempt && attempt.match.percent >= PASS_PERCENT;
  const showEnglish = mode === 'shadow' || !mine || revealed || attempt;

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <ProgressBar value={idx} max={dialogue.length} className="h-2 flex-1" label="Dialog jarayoni" />
        <span className="text-sm font-bold tabular">
          {idx + 1}
          <span className="text-muted-foreground">/{dialogue.length}</span>
        </span>
      </div>

      <p className="text-sm font-semibold text-muted-foreground">{COPY[mode].title}</p>

      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: EASE }}
          className={cn(
            'mt-3 rounded-2xl border p-4 sm:p-5',
            mine ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/50'
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {line.speaker}
              {mode === 'recall' && (mine ? ' · siz' : ' · suhbatdosh')}
            </p>
            {showEnglish && (
              <Button
                variant="outline"
                size="icon-sm"
                className="shrink-0 rounded-full"
                onClick={() => playTTSAudio(line.en, 'en-GB', 0.85)}
                aria-label="Qatorni eshitish"
              >
                <Volume2 />
              </Button>
            )}
          </div>

          {attempt ? (
            <MatchedLine words={attempt.match.words} />
          ) : showEnglish ? (
            <p className="text-lg font-semibold leading-relaxed">{line.en}</p>
          ) : (
            <p className="text-lg font-semibold leading-relaxed text-muted-foreground/70">• • •</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">{line.uz}</p>
        </motion.div>
      </AnimatePresence>

      {/* Suhbatdosh qatori — faqat tinglash */}
      {!mine ? (
        <div className="mt-5 flex justify-end">
          <Button size="lg" onClick={next}>
            {last ? doneLabel : 'Keyingi'} <ArrowRight />
          </Button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {attempt && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'rounded-2xl border px-4 py-3 text-sm',
                passed ? 'border-success/30 bg-success/8' : 'border-warning/35 bg-warning/10'
              )}
            >
              <p className="font-bold">
                {passed ? 'Zo\'r!' : 'Yana bir bor urinib ko\'ring'} · <span className="tabular">{attempt.match.percent}%</span>
              </p>
              <p className="mt-0.5 text-muted-foreground">Brauzer eshitgani: &ldquo;{attempt.spoken}&rdquo;</p>
            </motion.div>
          )}

          {speech.supported ? (
            <div className="flex flex-wrap items-center gap-2">
              {!attempt ? (
                <Button
                  size="lg"
                  variant={speech.listening ? 'destructive' : 'brand'}
                  onClick={speech.toggle}
                  className="flex-1 sm:flex-none"
                >
                  {speech.listening ? <MicOff /> : <Mic />}
                  {speech.listening ? "To'xtatish" : 'Aytish'}
                </Button>
              ) : (
                <Button size="lg" variant="outline" onClick={retry}>
                  <RotateCcw /> Qayta aytish
                </Button>
              )}
              {mode === 'recall' && !showEnglish && (
                <Button variant="ghost" onClick={() => setRevealed(true)}>
                  <Eye /> Ko&apos;rsatish
                </Button>
              )}
              <Button size="lg" variant={attempt ? 'default' : 'ghost'} className="ml-auto" onClick={next}>
                {last ? doneLabel : attempt ? 'Keyingi' : "O'tkazib yuborish"} {attempt && <ArrowRight />}
              </Button>
            </div>
          ) : (
            // Ovoz tanilmaydigan brauzer: shadow — ovoz chiqarib takrorlash, recall — yozib tekshirish
            <div className="space-y-3">
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" />
                Bu brauzer ovozni tanimaydi.{' '}
                {mode === 'shadow' ? 'Qatorni tinglab, ovoz chiqarib takrorlang.' : 'Qatorni ovoz chiqarib ayting, keyin yozib tekshiring.'}
              </p>
              {mode === 'recall' && !attempt && (
                <form onSubmit={checkTyped} className="flex gap-2">
                  <input
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
                    placeholder="Inglizcha qator…"
                    aria-label="Inglizcha qator"
                    autoComplete="off"
                  />
                  <Button type="submit" disabled={!typed.trim()}>
                    <Check /> Tekshirish
                  </Button>
                </form>
              )}
              <div className="flex justify-end">
                <Button size="lg" onClick={next}>
                  {last ? doneLabel : mode === 'shadow' ? 'Takrorladim' : 'Keyingi'} <ArrowRight />
                </Button>
              </div>
            </div>
          )}

          {speech.listening && speech.interim && (
            <p className="text-sm italic text-muted-foreground">&ldquo;{speech.interim}&rdquo;</p>
          )}
          {speech.error && <p className="text-sm text-destructive">{speech.error}</p>}
        </div>
      )}

      <p className="mt-6 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Bu talaffuz bahosi emas: brauzer tanigan matn dialog qatori bilan solishtiriladi. Ovozingiz hech qayerga yuborilmaydi.
      </p>
    </div>
  );
};

export default DialoguePractice;
