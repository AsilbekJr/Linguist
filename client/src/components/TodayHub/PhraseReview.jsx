import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'react-hot-toast';
import { ArrowRight, Check, Eye, Keyboard, Loader2, Mic, MicOff, Quote, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { useCheckPhraseMutation } from '../../features/api/apiSlice';
import { useSpeechInput } from '../../hooks/useSpeechInput';
import { playTTSAudio } from '../../utils/audio';

const EASE = [0.16, 1, 0.3, 1];

/**
 * Ibora kartalari — sahnada "Yod olish" qadamida yodlangan kalit gaplar.
 *
 * Topshiriq doim bitta: o'zbekcha ma'nodan butun inglizcha gapni ovoz
 * chiqarib aytish. So'z kartasida so'z alohida eslanadi, bu yerda esa
 * gapning ohangi va tuzilishi bilan — yodlangan narsa nutqda ishlatiladigan
 * tayyor ibora bo'lib qoladi. Baho serverda (jadvalga ta'sir qiladi).
 */
const PhraseReview = ({ phrases, onChecked, onFinished, finishLabel = "So'zlarga o'tish" }) => {
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [voiceText, setVoiceText] = useState('');
  const [checkPhrase, { isLoading }] = useCheckPhraseMutation();

  const card = phrases[index];

  const send = async (answer, source) => {
    const clean = String(answer || '').trim();
    if (!clean || isLoading) return;
    try {
      const res = await checkPhrase({ id: card._id, answer: clean, source }).unwrap();
      setResult({ ...res, spoken: clean });
      onChecked?.(card._id, res);
    } catch (err) {
      toast.error(err?.data?.message || "Tekshirib bo'lmadi. Qayta urinib ko'ring.");
    }
  };

  const speech = useSpeechInput({ lang: 'en-US', onResult: text => { setTyped(text); setVoiceText(text); setTyping(true); } });

  const next = () => {
    speech.stop();
    setResult(null);
    setShowHint(false);
    setTyped('');
    setVoiceText('');
    if (index + 1 >= phrases.length) onFinished?.();
    else setIndex((i) => i + 1);
  };

  if (!card) return null;
  const textMode = typing || !speech.supported;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <ProgressBar value={index + (result ? 1 : 0)} max={phrases.length} className="h-2 flex-1" label="Iboralar" />
        <span className="text-sm font-bold tabular">
          {index + 1}
          <span className="text-muted-foreground">/{phrases.length}</span>
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={card._id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-6"
        >
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary">
            <Quote className="size-3.5" /> {card.sourceWord ? `“${card.sourceWord}” qatnashgan gap` : 'Saqlangan gap'} · eslang
          </p>
          <p className="mt-3 text-xl font-extrabold leading-snug">{card.textUz}</p>

          {result ? (
            <div className="mt-4 space-y-2">
              <p className="text-lg font-semibold leading-relaxed">
                {result.words.map((w, i) => (
                  <React.Fragment key={i}>
                    <span className={w.hit ? 'text-success' : 'text-destructive underline decoration-2 underline-offset-4'}>{w.text}</span>{' '}
                  </React.Fragment>
                ))}
              </p>
              <Button variant="outline" size="sm" onClick={() => playTTSAudio(result.text, 'en-GB', 0.85)}>
                <Volume2 /> Eshitish
              </Button>
            </div>
          ) : (
            showHint && <p className="mt-3 font-mono text-base tracking-wide text-muted-foreground">{card.hint}</p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-4 space-y-3">
        {result ? (
          <>
            <div
              className={cn(
                'rounded-2xl border px-4 py-3 text-sm',
                result.isCorrect ? 'border-success/30 bg-success/8' : 'border-warning/35 bg-warning/10'
              )}
            >
              <p className="font-bold">
                {result.isCorrect ? 'Yodingizda!' : "Deyarli — to'g'risini eshitib, ovoz chiqarib takrorlang"} ·{' '}
                <span className="tabular">{result.percent}%</span>
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {result.practice
                  ? "Mashq — jadval o'zgarmadi."
                  : result.learned
                    ? "Bu ibora endi to'liq yodlangan."
                    : result.isCorrect
                      ? `Keyingi safar ${result.intervalDays} kundan keyin.`
                      : 'Ertaga yana qaytadi.'}
              </p>
            </div>
            <div className="flex justify-end">
              <Button size="lg" onClick={next}>
                {index + 1 >= phrases.length ? finishLabel : 'Keyingi'} <ArrowRight />
              </Button>
            </div>
          </>
        ) : (
          <>
            {textMode && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send(typed, voiceText && typed.trim() === voiceText.trim() ? 'voice' : 'text');
                }}
              >
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="Inglizcha gap…"
                  maxLength={400}
                  autoComplete="off"
                  autoCapitalize="none"
                  className="h-12 min-w-0 flex-1 rounded-2xl border border-input bg-background px-4 text-base outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
                  aria-label="Inglizcha gap"
                />
                <Button type="submit" size="lg" disabled={!typed.trim() || isLoading || speech.listening} aria-label="Gapni tekshirish">
                  {isLoading ? <Loader2 className="animate-spin" /> : <Check />}
                </Button>
              </form>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {speech.supported && !typing && (
                <Button
                  size="lg"
                  variant={speech.listening ? 'destructive' : 'brand'}
                  onClick={speech.toggle}
                  disabled={isLoading}
                  className="flex-1 sm:flex-none"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : speech.listening ? <MicOff /> : <Mic />}
                  {speech.listening ? "To'xtatish" : 'Aytish'}
                </Button>
              )}
              {!showHint && (
                <Button variant="ghost" onClick={() => setShowHint(true)}>
                  <Eye /> Birinchi harflar
                </Button>
              )}
              {speech.supported && (
                <Button
                  variant={typing ? 'soft' : 'ghost'}
                  size="icon"
                  className="ml-auto"
                  onClick={() => { speech.stop(); setTyping((v) => !v); }}
                  aria-label="Yozib javob berish"
                  aria-pressed={typing}
                >
                  <Keyboard />
                </Button>
              )}
            </div>
            {speech.listening && speech.interim && (
              <p className="text-sm italic text-muted-foreground">&ldquo;{speech.interim}&rdquo;</p>
            )}
            {speech.error && <p role="alert" className="text-sm text-destructive">{speech.error}</p>}
            {voiceText && <p className="text-xs text-muted-foreground">Tanilgan matnni tekshiring, kerak bo&apos;lsa tuzating va yuboring.</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default PhraseReview;
