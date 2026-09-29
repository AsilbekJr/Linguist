import React, { useState, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'react-hot-toast';
import {
  useGetCurrentChallengeQuery,
  useGetChallengeHistoryQuery,
  useCompleteChallengeMutation,
  useAddWordMutation,
} from '../features/api/apiSlice';
import { Button } from '@/components/ui/button';
import { EmptyState, PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { Mic, Square, Send, Loader2, CheckCircle2, Plus, X, Volume2, Flame, Trophy, RotateCcw, AlertTriangle } from 'lucide-react';
import { playTTSAudio } from '../utils/audio';
import { fireConfetti } from '../utils/celebration';

const TOTAL_DAYS = 100;

/** Natija rangi — Tailwind klasslari statik bo'lishi shart. Ilgari
 *  `border-${color}-200` yozilgan edi va bunday klass hech qachon generatsiya
 *  qilinmasdi (rang umuman chiqmasdi). */
const SCORE_STYLES = {
  green: 'border-success/30 bg-success/8',
  yellow: 'border-warning/35 bg-warning/10',
  red: 'border-destructive/30 bg-destructive/8',
};

/** 100 kunlik yo'l — har kun bitta katak */
const DaysGrid = ({ completed }) => (
  <div className="grid grid-cols-10 gap-1 sm:grid-cols-20 sm:gap-1.5" aria-label={`${completed} / ${TOTAL_DAYS} kun bajarildi`}>
    {Array.from({ length: TOTAL_DAYS }).map((_, i) => {
      const done = i < completed;
      const today = i === completed;
      return (
        <motion.span
          key={i}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: Math.min(i, 60) * 0.006, duration: 0.3 }}
          className={cn(
            'aspect-square rounded-[5px] sm:rounded-md',
            done ? 'bg-streak' : today ? 'bg-streak/25 ring-2 ring-streak/50' : 'bg-muted'
          )}
        />
      );
    })}
  </div>
);

const ChallengeMode = () => {
  const { data: history, isLoading: isHistoryLoading, refetch: refetchHistory } = useGetChallengeHistoryQuery();
  const { data: currentChallenge, isLoading: isCurrentLoading, refetch: refetchCurrent } = useGetCurrentChallengeQuery();
  const [completeChallenge, { isLoading: isCompleting }] = useCompleteChallengeMutation();
  const [addWord] = useAddWordMutation();

  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBase64, setAudioBase64] = useState(null);
  const [spokenText, setSpokenText] = useState('');
  const [error, setError] = useState('');
  const [selectedWord, setSelectedWord] = useState(null);
  const [isAddingWord, setIsAddingWord] = useState(false);

  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioUrl(URL.createObjectURL(audioBlob));
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => setAudioBase64(reader.result);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError('');
      setSpokenText('');

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';
        rec.onresult = (event) => {
          let trans = '';
          for (let i = 0; i < event.results.length; ++i) trans += event.results[i][0].transcript;
          setSpokenText(trans);
        };
        recognitionRef.current = rec;
        try {
          rec.start();
        } catch (e) {
          console.warn('Speech API start error', e);
        }
      }
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError("Mikrofonga ulanib bo'lmadi. Brauzerda mikrofonga ruxsat berilganini tekshiring.");
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    mediaRecorderRef.current.stop();
    setIsRecording(false);
    // Mikrofonni bo'shatamiz — aks holda brauzerda "yozilmoqda" belgisi qoladi
    mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    try {
      recognitionRef.current?.stop();
    } catch {
      // SpeechRecognition allaqachon to'xtagan bo'lsa xato tashlaydi — bu normal
    }
  };

  const handleSubmit = async () => {
    if (!audioBase64 || !currentChallenge) return;
    try {
      await completeChallenge({
        challengeId: currentChallenge._id,
        audioData: audioBase64,
        spokenText,
      }).unwrap();
      setAudioUrl(null);
      setAudioBase64(null);
      setSpokenText('');
      fireConfetti();
      toast.success('Bugungi kun bajarildi!');
      refetchHistory();
      refetchCurrent();
    } catch {
      setError("Saqlashda xatolik yuz berdi. Qayta urinib ko'ring.");
    }
  };

  /**
   * Matndagi so'zni lug'atga qo'shish.
   * Ilgari bu `onAddWord` prop orqali chaqirilardi, lekin sahifa uni hech
   * qachon uzatmasdi — tugma har safar "internetni tekshiring" deb yiqilardi.
   */
  const handleQuickAddWord = async () => {
    if (!selectedWord) return;
    setIsAddingWord(true);
    try {
      await addWord({ word: selectedWord, skipAI: false }).unwrap();
      toast.success(`"${selectedWord}" lug'atga qo'shildi`);
      setSelectedWord(null);
    } catch (err) {
      const data = err?.data || {};
      if (data.type === 'DUPLICATE') toast(`"${selectedWord}" allaqachon lug'atingizda`, { icon: 'ℹ️' });
      else toast.error(data.message || "So'zni qo'shib bo'lmadi. Keyinroq urining.");
    } finally {
      setIsAddingWord(false);
    }
  };

  // Matnni so'zlarga bo'lib, har birini bosiladigan qilamiz; **so'z** — kun so'zlari
  const renderTextContent = (text) => {
    if (!text) return null;
    return text.split(/(\s+)/).map((segment, i) => {
      if (/^\s+$/.test(segment)) return <span key={i}>{segment}</span>;
      let clean = segment;
      const isTarget = clean.startsWith('**') && clean.endsWith('**');
      if (isTarget) clean = clean.slice(2, -2);
      const wordToSave = clean.replace(/[.,/#!$%^&*;:{}=\-_`~()?"]/g, '').trim();
      return (
        <button
          key={i}
          type="button"
          onClick={() => wordToSave && setSelectedWord(wordToSave)}
          className={cn(
            'rounded-md px-0.5 transition-colors',
            isTarget ? 'bg-primary/12 font-bold text-primary hover:bg-primary/20' : 'hover:bg-accent hover:text-primary',
            selectedWord === wordToSave && 'bg-primary text-primary-foreground'
          )}
        >
          {clean}
        </button>
      );
    });
  };

  if (isCurrentLoading) return <PageSkeleton cards={1} />;

  const completedCount = history ? history.filter((h) => h.status === 'completed').length : 0;
  const last = currentChallenge?.lastChallenge;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="100 kunlik challenge"
        title="Har kuni — bitta matn yoddan"
        tone="streak"
        icon={Flame}
        description="Matnni o'qing, tinglang, yodlang va yoddan aytib yozib qoldiring. Izchillik — muvaffaqiyat kaliti."
      />

      {/* 100 kunlik yo'l */}
      <section className="surface mb-6 p-5 sm:p-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-extrabold tabular">
              {isHistoryLoading ? '—' : completedCount}
              <span className="text-lg text-muted-foreground">/{TOTAL_DAYS}</span>
            </p>
            <p className="text-sm text-muted-foreground">kun bajarildi</p>
          </div>
          <p className="text-sm font-semibold text-muted-foreground">{TOTAL_DAYS - completedCount} kun qoldi</p>
        </div>
        <DaysGrid completed={completedCount} />
      </section>

      {!currentChallenge ? (
        <EmptyState icon={AlertTriangle} tone="warning" title="Mashg'ulotni yuklab bo'lmadi" description="Sahifani yangilab ko'ring.">
          <Button onClick={() => window.location.reload()}>Yangilash</Button>
        </EmptyState>
      ) : currentChallenge.isFinished ? (
        <EmptyState icon={Trophy} tone="xp" title="Tabriklaymiz!" description="Siz 100 kunlik challenge'ni muvaffaqiyatli yakunladingiz!" />
      ) : currentChallenge.isCompleteForToday ? (
        <section className="surface p-6 text-center sm:p-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 15 }}
            className="mx-auto mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-success/12 text-success"
          >
            <CheckCircle2 className="size-8" />
          </motion.div>
          <h2 className="text-2xl font-extrabold">Bugungi vazifa bajarildi!</h2>
          <p className="mt-1 text-muted-foreground">Ertaga yangi matn bilan qayting.</p>

          {last?.audioData && (
            <div className="mt-8 text-left">
              <p className="mb-3 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground">Bugungi yozuvingiz</p>
              <audio src={last.audioData} controls className="mx-auto w-full max-w-md" />
              {last.score != null && (
                <div className={cn('mt-5 rounded-2xl border p-5', SCORE_STYLES[last.color] || 'border-border bg-muted/50')}>
                  <p className="font-bold">
                    Moslik: <span className="tabular">{last.score}%</span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{last.feedback}</p>
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        <section className="surface p-5 sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-streak/12 px-3 py-1 text-sm font-bold text-streak">
                {currentChallenge.dayNumber}-kun
              </span>
              <span className="text-sm font-medium text-muted-foreground">{currentChallenge.topic}</span>
            </div>
            <Button variant="soft" size="sm" onClick={() => playTTSAudio(currentChallenge.text, 'en-US', 0.85)}>
              <Volume2 /> Eshitish
            </Button>
          </div>

          <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
            <p className="text-lg leading-[1.9] sm:text-xl">{renderTextContent(currentChallenge.text)}</p>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Istalgan so&apos;zni bosib, lug&apos;atga qo&apos;shishingiz mumkin.</p>

          <AnimatePresence>
            {selectedWord && (
              <motion.div
                initial={{ opacity: 0, y: 8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center">
                  <p className="flex-1 text-sm">
                    <span className="text-lg font-extrabold text-primary">{selectedWord}</span> so&apos;zini lug&apos;atga qo&apos;shasizmi?
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon-sm" onClick={() => playTTSAudio(selectedWord, 'en-GB', 1)} aria-label="Tinglash">
                      <Volume2 />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedWord(null)}>
                      <X /> Yo&apos;q
                    </Button>
                    <Button size="sm" onClick={handleQuickAddWord} disabled={isAddingWord}>
                      {isAddingWord ? <Loader2 className="animate-spin" /> : <Plus />} Qo&apos;shish
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div role="alert" className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm font-medium text-destructive">
              {error}
            </div>
          )}

          <div className="mt-8 flex flex-col items-center">
            {!audioUrl ? (
              <>
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={cn(
                    'relative inline-flex size-20 items-center justify-center rounded-full text-white transition-transform hover:scale-105 active:scale-95',
                    isRecording ? 'bg-destructive' : 'brand-gradient shadow-[0_16px_40px_-12px_color-mix(in_oklch,var(--primary)_75%,transparent)]'
                  )}
                  aria-label={isRecording ? "Yozishni to'xtatish" : 'Yozishni boshlash'}
                >
                  {isRecording && <span className="absolute inset-0 animate-ping rounded-full bg-destructive/40" />}
                  {isRecording ? <Square className="relative size-7 fill-current" /> : <Mic className="size-8" />}
                </button>
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  {isRecording ? "Yozilmoqda… to'xtatish uchun bosing" : 'Yoddan aytishni boshlash uchun bosing'}
                </p>
                {isRecording && spokenText && <p className="mt-3 max-w-md text-center text-sm italic text-muted-foreground">&ldquo;{spokenText}&rdquo;</p>}
              </>
            ) : (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md space-y-4 rounded-3xl border border-border bg-muted/40 p-5">
                <audio src={audioUrl} controls className="w-full" />
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setAudioUrl(null)}>
                    <RotateCcw /> Qayta yozish
                  </Button>
                  <Button variant="success" className="flex-1" onClick={handleSubmit} disabled={isCompleting || !audioBase64}>
                    {isCompleting ? <Loader2 className="animate-spin" /> : <Send />} Yuborish
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};

export default ChallengeMode;
