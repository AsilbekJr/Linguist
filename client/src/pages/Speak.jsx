import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'react-hot-toast';
import {
  Mic, Square, Send, Volume2, VolumeX, Languages, Lightbulb, Check, Lock, Loader2,
  MessagesSquare, Sparkles, Target, ArrowRight, Keyboard, Timer, RotateCcw, ScanText,
} from 'lucide-react';
import {
  useGetSpeakTodayQuery,
  useStartSpeakMutation,
  useSpeakTurnMutation,
  useSpeakHintMutation,
  useFinishSpeakMutation,
  useGetMeQuery,
} from '../features/api/apiSlice';
import { RecordCard } from '../components/VoiceDiary/DiaryParts';
import { PHRASE_MAX_SECONDS } from '../utils/diaryLogic';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { playTTSAudio, stopTTSAudio } from '../utils/audio';
import { burstAt, fireConfetti } from '../utils/celebration';
import { track, EVENTS } from '../lib/analytics';
import { Button } from '@/components/ui/button';
import { FadeIn, IconTile, PageHeader, PageSkeleton, ProgressBar } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { dayKeyInZone } from '../utils/dayRefresh';

/**
 * Suhbat — bugungi sahna qahramoni bilan ovozli rolli o'yin.
 *
 * Sahnada dialog YODLANADI, bu yerda esa o'sha so'zlar JONLI vaziyatda
 * ishlatiladi: dorixonada farmatsevtga, aeroportda xodimga o'zingiz
 * gapirasiz. Bugungi so'zni aytishingiz bilan uning belgisi yonadi.
 * Yakunda eng muhim xatolar to'g'ri varianti bilan ko'rsatiladi.
 *
 * Ovoz ham, nutqni tanish ham brauzerning o'zida — audio hech qayerga
 * yuborilmaydi, serverga faqat tanilgan MATN boradi.
 */

const SOUND_KEY = 'linguist_speak_sound';

const readSoundPref = () => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
};

const speak = (text, rate = 0.92) => playTTSAudio(text, 'en-US', rate);

/** Brauzer nutqni matnga aylantira oladimi (Firefox — yo'q) */
const micSupported =
  typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

// ─── Kichik qismlar ─────────────────────────────────────────────────────────

const PartnerAvatar = ({ partner, size = 'md' }) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-fuchsia-500/20 ring-1 ring-primary/20',
      size === 'lg' ? 'size-16 text-3xl' : 'size-11 text-xl'
    )}
    aria-hidden="true"
  >
    {partner?.emoji || '💬'}
  </span>
);

/** Bugungi so'z belgisi — ishlatilganda yonadi (asosiy "voy" lahzasi) */
const WordChip = React.forwardRef(({ word, used }, ref) => (
  <motion.span
    ref={ref}
    layout
    animate={used ? { scale: [1, 1.18, 1] } : { scale: 1 }}
    transition={{ duration: 0.45 }}
    className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors duration-500',
      used ? 'border-success/40 bg-success/15 text-success' : 'border-border bg-card text-muted-foreground'
    )}
    title={word.translation}
  >
    {used && <Check className="size-3.5" strokeWidth={3} />}
    {word.word}
  </motion.span>
));
WordChip.displayName = 'WordChip';

const Missions = ({ conv, chipRefs }) => {
  const turnsDone = Math.min(conv.userTurns, conv.minTurns);
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 flex items-center justify-between text-xs font-semibold text-muted-foreground">
          <span>Bugungi so&apos;zlardan {conv.wordsGoal} tasini ishlating</span>
          <span className={cn('tabular', conv.wordsUsed >= conv.wordsGoal && 'text-success')}>
            {Math.min(conv.wordsUsed, conv.wordsGoal)}/{conv.wordsGoal}
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {conv.targetWords.map((w) => (
            <WordChip
              key={w.word}
              word={w}
              used={w.used}
              ref={(el) => {
                if (el) chipRefs.current[w.word] = el;
              }}
            />
          ))}
        </div>
      </div>
      {conv.goals.length > 0 && (
        <ul className="space-y-1">
          {conv.goals.map((g) => (
            <li key={g.id} className={cn('flex items-center gap-2 text-sm', g.done ? 'text-success' : 'text-foreground')}>
              <span
                className={cn(
                  'inline-flex size-5 shrink-0 items-center justify-center rounded-full border',
                  g.done ? 'border-success bg-success text-success-foreground' : 'border-border'
                )}
              >
                {g.done ? <Check className="size-3" strokeWidth={3} /> : <Target className="size-3 text-muted-foreground" />}
              </span>
              <span className={cn(g.done && 'line-through decoration-success/50')}>{g.textUz}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2">
        <ProgressBar value={turnsDone} max={conv.minTurns} className="h-1.5 flex-1" label="Javoblar" />
        <span className="text-xs font-semibold text-muted-foreground tabular">
          {turnsDone}/{conv.minTurns} javob
        </span>
      </div>
    </div>
  );
};

const Bubble = ({ turn, partner, showUz, onReplay }) => {
  const mine = turn.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn('flex gap-2', mine ? 'justify-end' : 'justify-start')}
    >
      {!mine && <PartnerAvatar partner={partner} />}
      <div
        className={cn(
          'max-w-[82%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed',
          mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border border-border bg-card'
        )}
      >
        <p>{turn.text}</p>
        {!mine && showUz && turn.textUz && (
          <p className="mt-1 text-sm text-muted-foreground">{turn.textUz}</p>
        )}
        {!mine && (
          <button
            type="button"
            onClick={() => onReplay(turn.text)}
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            aria-label="Qayta eshitish"
          >
            <Volume2 className="size-3.5" /> Eshitish
          </button>
        )}
        {mine && turn.via === 'voice' && (
          <span className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-primary-foreground/70">
            <Mic className="size-3" /> ovozli
          </span>
        )}
      </div>
    </motion.div>
  );
};

// ─── Asosiy ko'rinishlar ────────────────────────────────────────────────────

const Locked = ({ preview }) => (
  <FadeIn className="surface mx-auto max-w-xl p-6 text-center sm:p-8">
    <IconTile icon={Lock} tone="primary" size="lg" className="mx-auto mb-4" />
    <h2 className="text-xl font-extrabold">Avval bugungi sahna</h2>
    <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
      Suhbat sahnada o&apos;rgangan so&apos;zlaringiz ustida bo&apos;ladi.
      {preview && (
        <>
          {' '}Bugun sizni <strong>{preview.partner.name}</strong> kutyapti — {preview.topicUz.toLowerCase()}.
        </>
      )}
    </p>
    <Button asChild size="lg" variant="brand" className="mt-6">
      <Link to="/topic">
        Sahnaga o&apos;tish <ArrowRight />
      </Link>
    </Button>
  </FadeIn>
);

const Intro = ({ preview, onStart, starting, canStart, limitMessage, micSupported }) => (
  <FadeIn className="mx-auto max-w-xl space-y-4">
    <div className="hero-mesh noise relative overflow-hidden rounded-[1.75rem] p-6 text-white sm:p-8">
      <div className="flex items-center gap-4">
        <span className="inline-flex size-16 items-center justify-center rounded-2xl bg-white/15 text-3xl" aria-hidden="true">
          {preview.partner.emoji}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/75">Bugungi suhbatdosh</p>
          <h2 className="text-2xl font-extrabold leading-tight">{preview.partner.name}</h2>
          <p className="text-sm text-white/80">{preview.topicUz}</p>
        </div>
      </div>
      <p className="mt-5 text-[15px] leading-relaxed text-white/90">{preview.situationUz}</p>
      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/70">Shu so&apos;zlarni ishlating</p>
        <div className="flex flex-wrap gap-1.5">
          {preview.targetWords.map((w) => (
            <span key={w.word} className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
              {w.word} <span className="font-normal text-white/70">· {w.translation}</span>
            </span>
          ))}
        </div>
      </div>
    </div>

    <div className="surface grid gap-3 p-5 text-sm sm:grid-cols-3">
      <div className="flex items-center gap-2"><Mic className="size-4 text-primary" /> Ovoz bilan javob bering</div>
      <div className="flex items-center gap-2"><Target className="size-4 text-primary" /> Topshiriqlarni bajaring</div>
      <div className="flex items-center gap-2"><Timer className="size-4 text-primary" /> ~5 daqiqa</div>
    </div>

    {!micSupported && (
      <p className="rounded-2xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm">
        Bu brauzer mikrofonni matnga aylantira olmaydi — javoblarni yozib berasiz. Ovoz bilan gaplashish uchun
        Chrome yoki Safari&apos;dan foydalaning.
      </p>
    )}

    {canStart ? (
      <Button size="xl" variant="brand" className="w-full" onClick={onStart} disabled={starting}>
        {starting ? <Loader2 className="animate-spin" /> : <><MessagesSquare /> Suhbatni boshlash</>}
      </Button>
    ) : (
      <p className="text-center text-sm text-muted-foreground">{limitMessage}</p>
    )}
  </FadeIn>
);

const Result = ({ conv, onAgain, canStartNew }) => {
  const navigate = useNavigate();
  const { data: me } = useGetMeQuery();
  const [diarySaved, setDiarySaved] = useState(false);
  // Ovoz kundaligi uchun: tuzatilgan gap — uni to'g'ri aytib yozib qo'yish
  const diaryLine = conv.feedback?.corrections?.[0]?.better || '';
  const goalsDone = conv.goals.filter((g) => g.done).length;
  const minutes = Math.floor(conv.spokenSeconds / 60);
  const seconds = conv.spokenSeconds % 60;
  // Uchinchi ko'rsatkich: gapirilgan vaqt, bo'lmasa maqsadlar. Ikkalasi ham
  // yo'q bo'lsa (ssenariy rejimi + yozma javob) — "0 maqsad" ko'rsatilmaydi
  const third = conv.spokenSeconds
    ? { value: minutes ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`, label: 'gapirdingiz' }
    : conv.goals.length
      ? { value: `${goalsDone}/${conv.goals.length}`, label: 'maqsad' }
      : null;
  return (
    <FadeIn className="mx-auto max-w-xl space-y-4">
      <div className="hero-mesh noise relative overflow-hidden rounded-[1.75rem] p-6 text-center text-white sm:p-8">
        <span className="mx-auto inline-flex size-16 items-center justify-center rounded-2xl bg-white/15 text-3xl" aria-hidden="true">
          {conv.partner.emoji}
        </span>
        <h2 className="mt-4 text-2xl font-extrabold">Suhbat yakunlandi!</h2>
        <p className="mt-1 text-white/80">{conv.partner.name} bilan {conv.topicUz.toLowerCase()}</p>
        <div className={cn('mt-6 grid gap-2', third ? 'grid-cols-3' : 'grid-cols-2')}>
          <div className="rounded-2xl bg-white/12 p-3">
            <div className="text-2xl font-extrabold tabular">{conv.userTurns}</div>
            <div className="text-xs text-white/75">javob</div>
          </div>
          <div className="rounded-2xl bg-white/12 p-3">
            <div className="text-2xl font-extrabold tabular">
              {conv.wordsUsed}/{conv.targetWords.length}
            </div>
            <div className="text-xs text-white/75">yangi so&apos;z</div>
          </div>
          {third && (
            <div className="rounded-2xl bg-white/12 p-3">
              <div className="text-2xl font-extrabold tabular">{third.value}</div>
              <div className="text-xs text-white/75">{third.label}</div>
            </div>
          )}
        </div>
      </div>

      {conv.feedback?.summaryUz && (
        <div className="surface flex gap-3 p-5">
          <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-[15px] leading-relaxed">{conv.feedback.summaryUz}</p>
        </div>
      )}

      {conv.feedback?.corrections?.length > 0 && (
        <div className="surface space-y-3 p-5">
          <h3 className="font-extrabold">Shunday aytsangiz tabiiyroq</h3>
          {conv.feedback.corrections.map((c, i) => (
            <div key={i} className="space-y-1.5 rounded-2xl border border-border p-3">
              <p className="text-sm text-muted-foreground line-through decoration-destructive/60">{c.said}</p>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-success">{c.better}</p>
                <button
                  type="button"
                  onClick={() => speak(c.better, 0.85)}
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                  aria-label="To'g'ri variantni eshitish"
                >
                  <Volume2 className="size-4" />
                </button>
              </div>
              {c.explanationUz && <p className="text-sm text-muted-foreground">{c.explanationUz}</p>}
              {/* Gap tahlili endi menyuda emas — xato ko'rsatilgan joyda ochiladi */}
              <Link
                to={`/analysis?s=${encodeURIComponent(c.better)}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <ScanText className="size-3.5" /> Gapni tahlil qilish
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Ovoz kundaligi: bugungi gap qurilmada saqlanadi (ixtiyoriy) */}
      {me?.today && !diarySaved && (
        <div className="surface space-y-2 p-5">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
            <Mic className="size-3.5" /> Ovoz kundaligi · ixtiyoriy
          </p>
          <p className="text-sm text-muted-foreground">
            {diaryLine
              ? "To'g'ri variantni ovoz chiqarib yozib qo'ying — keyinroq o'zingizni eshitasiz:"
              : "Bugun suhbatda aytgan eng yaxshi gapingizni yozib qo'ying:"}
          </p>
          {diaryLine && <p className="font-semibold">{diaryLine}</p>}
          <RecordCard
            compact
            kind="phrase"
            dayKey={me.today}
            maxSeconds={PHRASE_MAX_SECONDS}
            text={diaryLine}
            onSaved={() => setDiarySaved(true)}
          />
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button size="lg" variant="brand" onClick={() => navigate('/')}>
          Davom etish <ArrowRight />
        </Button>
        {canStartNew && (
          <Button size="lg" variant="outline" onClick={onAgain}>
            <RotateCcw /> Yana suhbat
          </Button>
        )}
      </div>
    </FadeIn>
  );
};

const Conversation = ({ initial, onFinished }) => {
  const [conv, setConv] = useState(initial);
  const [showUz, setShowUz] = useState(false);
  const [soundOn, setSoundOn] = useState(readSoundPref);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [hint, setHint] = useState(null);
  const chipRefs = useRef({});
  const listRef = useRef(null);
  const startedAtRef = useRef(0);

  const [sendTurn, { isLoading: sending }] = useSpeakTurnMutation();
  const [getHint, { isLoading: hinting }] = useSpeakHintMutation();
  const [finish, { isLoading: finishing }] = useFinishSpeakMutation();

  const lastPartner = useMemo(
    () => [...conv.turns].reverse().find((t) => t.role === 'partner'),
    [conv.turns]
  );
  const turnLimitReached = conv.userTurns >= conv.maxTurns;

  // Cleanup also replaces the pending playback during StrictMode effect replay.
  useEffect(() => {
    const index = conv.turns.length - 1;
    const last = conv.turns[index];
    if (last?.role === 'partner' && soundOn) return speak(last.text);
  }, [conv.turns, soundOn]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [conv.turns.length, sending]);

  const submit = useCallback(
    async (text, via) => {
      const clean = String(text || '').trim();
      if (!clean || sending) return;
      const seconds = via === 'voice' && startedAtRef.current ? Math.round((Date.now() - startedAtRef.current) / 1000) : undefined;
      setHint(null);
      try {
        const res = await sendTurn({ id: conv.id, text: clean, via, seconds }).unwrap();
        setConv(res.conversation);
        setDraft('');
        // Yonayotgan so'zlar — kichik portlash bilan
        for (const word of res.newlyUsed || []) {
          requestAnimationFrame(() => burstAt(chipRefs.current[word]));
        }
        if (res.newlyUsed?.length) toast.success(`Zo'r! «${res.newlyUsed.join('», «')}» ishlatildi`, { icon: '✨' });
        if (res.newlyDone?.length) toast.success('Maqsad bajarildi!', { icon: '🎯' });
      } catch (err) {
        toast.error(err?.data?.message || "Javob yuborilmadi. Qayta urinib ko'ring.");
      }
    },
    [conv.id, sendTurn, sending]
  );

  const mic = useSpeechInput({ lang: 'en-US', onResult: (text) => submit(text, 'voice') });

  const startListening = () => {
    // Qahramon gapirayotgan bo'lsa to'xtatamiz — aks holda mikrofon uni eshitadi
    startedAtRef.current = Date.now();
    mic.start();
  };

  const toggleSound = () => {
    setSoundOn((v) => {
      const next = !v;
      try {
        localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
      } catch {
        // muhim emas
      }
      if (!next) stopTTSAudio();
      return next;
    });
  };

  const notUnderstood = () => {
    setShowUz(true);
    if (lastPartner) speak(lastPartner.text, 0.72);
  };

  const askHint = async () => {
    try {
      setHint(await getHint(conv.id).unwrap());
    } catch {
      toast.error("Yordamni olib bo'lmadi");
    }
  };

  const doFinish = async () => {
    try {
      const res = await finish(conv.id).unwrap();
      track(EVENTS.SPEAK_FINISHED, {
        turns: res.conversation.userTurns,
        wordsUsed: res.conversation.wordsUsed,
        mode: res.conversation.mode,
      });
      if (res.dailyStep?.message) toast.success(res.dailyStep.message);
      if (res.dailyStep?.planCompleted && res.dailyStep?.streakUpdated) fireConfetti(1500);
      onFinished(res.conversation);
    } catch (err) {
      toast.error(err?.data?.message || "Yakunlab bo'lmadi");
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <PartnerAvatar partner={conv.partner} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold">{conv.partner.name}</p>
            <p className="truncate text-xs text-muted-foreground">{conv.topicUz}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={toggleSound} aria-label={soundOn ? "Ovozni o'chirish" : 'Ovozni yoqish'}>
            {soundOn ? <Volume2 /> : <VolumeX />}
          </Button>
          <Button
            variant={showUz ? 'soft' : 'ghost'}
            size="icon-sm"
            onClick={() => setShowUz((v) => !v)}
            aria-label="Tarjimani ko'rsatish"
            aria-pressed={showUz}
          >
            <Languages />
          </Button>
        </div>
        <Missions conv={conv} chipRefs={chipRefs} />
      </div>

      <div ref={listRef} className="flex max-h-[52vh] min-h-[220px] flex-col gap-3 overflow-y-auto px-1 py-2" aria-live="polite">
        {conv.turns.map((t, i) => (
          <Bubble
            key={i}
            turn={t}
            partner={conv.partner}
            showUz={showUz}
            onReplay={(text) => speak(text, 0.85)}
          />
        ))}
        {sending && (
          <div className="flex items-center gap-2 pl-14 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {conv.partner.name} javob bermoqda…
          </div>
        )}
      </div>

      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl border border-info/30 bg-info/8 p-4 text-sm"
          >
            {hint.example && (
              <p>
                <span className="font-semibold">Masalan:</span> {hint.example.text}
                {hint.example.textUz && <span className="block text-muted-foreground">{hint.example.textUz}</span>}
              </p>
            )}
            {hint.words?.length > 0 && (
              <p className="mt-2">
                <span className="font-semibold">Hali ishlatilmagan:</span>{' '}
                {hint.words.map((w) => `${w.word} (${w.translation})`).join(', ')}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass sticky bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-10 rounded-3xl border border-border p-3 lg:bottom-4">
        {mic.listening && (
          <p className="mb-2 min-h-5 px-2 text-center text-sm text-muted-foreground">{mic.interim || 'Eshityapman…'}</p>
        )}
        {mic.error && !mic.listening && (
          <p className="mb-2 px-2 text-center text-xs text-destructive">
            Mikrofon ishlamadi. Ruxsat berilganini tekshiring yoki yozib javob bering.
          </p>
        )}

        {turnLimitReached ? (
          <Button size="xl" variant="brand" className="w-full" onClick={doFinish} disabled={finishing}>
            {finishing ? <Loader2 className="animate-spin" /> : <>Suhbatni yakunlash <Check /></>}
          </Button>
        ) : (
          <>
            {(typing || !mic.supported) && (
              <form
                className="mb-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(draft, 'text');
                }}
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Inglizcha javob yozing…"
                  maxLength={300}
                  autoCapitalize="sentences"
                  className="h-12 min-w-0 flex-1 rounded-2xl border border-input bg-background px-4 text-base outline-none focus-visible:ring-4 focus-visible:ring-ring/20"
                  aria-label="Javob"
                />
                <Button type="submit" size="icon" disabled={!draft.trim() || sending} aria-label="Yuborish">
                  <Send />
                </Button>
              </form>
            )}
            <div className="flex items-center justify-between gap-2">
              {/* Telefonda faqat ikonka — mikrofon va Yakunlash bitta qatorga sig'sin */}
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2.5 sm:px-3.5"
                  onClick={notUnderstood}
                  disabled={!lastPartner}
                  aria-label="Tushunmadim"
                >
                  <RotateCcw /> <span className="hidden sm:inline">Tushunmadim</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2.5 sm:px-3.5"
                  onClick={askHint}
                  disabled={hinting}
                  aria-label="Yordam"
                >
                  <Lightbulb /> <span className="hidden sm:inline">Yordam</span>
                </Button>
              </div>

              {mic.supported && (
                <motion.button
                  type="button"
                  onClick={mic.listening ? mic.stop : startListening}
                  disabled={sending}
                  whileTap={{ scale: 0.92 }}
                  className={cn(
                    'relative inline-flex size-16 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-colors disabled:opacity-50',
                    mic.listening ? 'bg-destructive' : 'brand-gradient'
                  )}
                  aria-label={mic.listening ? "To'xtatish" : 'Gapirish'}
                >
                  {mic.listening && <span className="absolute inset-0 animate-ping rounded-full bg-destructive/40" />}
                  {mic.listening ? <Square className="relative size-6" /> : <Mic className="relative size-7" />}
                </motion.button>
              )}

              <div className="flex gap-1">
                {mic.supported && (
                  <Button
                    variant={typing ? 'soft' : 'ghost'}
                    size="icon-sm"
                    onClick={() => setTyping((v) => !v)}
                    aria-label="Yozib javob berish"
                    aria-pressed={typing}
                  >
                    <Keyboard />
                  </Button>
                )}
                <Button size="sm" variant={conv.canFinish ? 'success' : 'outline'} onClick={doFinish} disabled={!conv.canFinish || finishing}>
                  {finishing ? <Loader2 className="animate-spin" /> : 'Yakunlash'}
                </Button>
              </div>
            </div>
            {!conv.canFinish && (
              <p className="mt-2 text-center text-xs text-muted-foreground">
                Yakunlash uchun yana {conv.minTurns - conv.userTurns} marta javob bering
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const Speak = () => {
  const authTimezone = useSelector(state => state.auth.user?.timezone);
  const { timezone: profileTimezone } = useGetMeQuery(undefined, {
    selectFromResult: ({ data }) => ({ timezone: data?.timezone }),
  });
  const timezone = profileTimezone || authTimezone;
  const { data: cachedData, isLoading, isFetching, isError, refetch } = useGetSpeakTodayQuery();
  const data = cachedData?.dayKey && cachedData.dayKey !== dayKeyInZone(timezone) ? undefined : cachedData;
  const [startSpeak, { isLoading: starting }] = useStartSpeakMutation();
  const [active, setActive] = useState(null);
  const [finished, setFinished] = useState(null);

  // Server holatidan: tugallanmagan suhbat bo'lsa — davom etadi
  const current = active || (data?.conversation?.status === 'active' ? data.conversation : null);
  const done = finished || (data?.conversation?.status === 'completed' ? data.conversation : null);

  const start = async () => {
    try {
      const res = await startSpeak().unwrap();
      track(EVENTS.SPEAK_STARTED, { mode: res.conversation.mode, resumed: res.resumed });
      setFinished(null);
      setActive(res.conversation);
    } catch (err) {
      toast.error(err?.data?.message || "Suhbatni boshlab bo'lmadi");
      refetch();
    }
  };

  if (!data && (isLoading || isFetching)) return <PageSkeleton cards={2} />;
  if (isError || !data) {
    return (
      <div className="surface mx-auto max-w-xl p-6 text-center">
        <p className="text-muted-foreground">Suhbatni yuklab bo&apos;lmadi.</p>
        <Button className="mt-4" variant="outline" onClick={refetch}>Qayta urinish</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Kunlik reja · 2-qadam"
        title="Suhbat"
        description="Bugungi sahna qahramoni bilan gaplashing — o'rgangan so'zlaringizni jonli vaziyatda ishlating."
        icon={MessagesSquare}
      />

      {!data.sceneDone ? (
        <Locked preview={data.preview} />
      ) : current ? (
        <Conversation
          key={current.id}
          initial={current}
          onFinished={(conv) => {
            setActive(null);
            setFinished(conv);
            refetch();
          }}
        />
      ) : done ? (
        <Result conv={done} canStartNew={data.canStartNew} onAgain={start} />
      ) : data.preview ? (
        <Intro
          preview={data.preview}
          onStart={start}
          starting={starting}
          canStart={data.canStartNew}
          micSupported={micSupported}
          limitMessage="Bugungi suhbat limiti tugadi. Ertaga yangi sahna bilan yangi suhbat!"
        />
      ) : null}
    </div>
  );
};

export default Speak;
