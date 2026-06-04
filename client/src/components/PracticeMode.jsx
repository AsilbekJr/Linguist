import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  useGetPracticeSessionQuery,
  useGetPracticePromptMutation,
  useCheckPracticeSentenceMutation,
  useSyncDailyQuestMutation,
} from '../features/api/apiSlice';
import { ChevronLeft, PenLine, Sparkles, Volume2, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { playTTSAudio } from '../utils/audio';
import { fireConfetti } from '../utils/celebration';

const PracticeMode = () => {
  const { data: session, isLoading } = useGetPracticeSessionQuery();
  const [getPrompt, { isLoading: loadingPrompt }] = useGetPracticePromptMutation();
  const [checkSentence, { isLoading: checking }] = useCheckPracticeSentenceMutation();
  const [syncDailyQuest] = useSyncDailyQuestMutation();

  const [activeRound, setActiveRound] = useState(null);
  const [prompt, setPrompt] = useState(null);
  const [sentence, setSentence] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [completedRounds, setCompletedRounds] = useState(0);
  const questSyncedRef = useRef(false);

  const rounds = session?.rounds || [];
  const stats = session?.stats;

  const startRound = async (round) => {
    setActiveRound(round);
    setSentence('');
    setFeedback(null);
    setPrompt(null);
    try {
      const data = await getPrompt({
        wordIds: round.words.map((w) => w._id),
        bucketLabel: round.bucketLabel,
      }).unwrap();
      setPrompt(data);
    } catch (err) {
      console.error('Practice prompt error:', err);
      setPrompt({
        promptUz: `${round.bucketLabel}: quyidagi so'zlardan kamida ikkitasini ishlatib ingliz tilida gap yozing: ${round.words.map((w) => w.word).join(', ')}.`,
        targetWords: round.words.map((w) => w.word),
        miniTipUz: "So'zlarni tabiiy jumla ichida ishlating.",
      });
    }
  };

  const syncQuestIfNeeded = () => {
    if (questSyncedRef.current) return;
    questSyncedRef.current = true;
    syncDailyQuest({ type: 'immersion' })
      .unwrap()
      .then((res) => {
        if (res.xpAwarded) toast.success(res.message || `+${res.xpAwarded} XP`);
        if (res.streakUpdated) {
          fireConfetti();
          toast.success(res.message, { icon: '🔥' });
        }
      })
      .catch((err) => {
        questSyncedRef.current = false;
        console.error('Practice quest sync failed', err);
      });
  };

  const handleCheck = async () => {
    if (!sentence.trim() || !activeRound) return;
    try {
      const data = await checkSentence({
        wordIds: activeRound.words.map((w) => w._id),
        sentence: sentence.trim(),
      }).unwrap();
      setFeedback(data);
      if (data.isCorrect) {
        const next = completedRounds + 1;
        setCompletedRounds(next);
        if (next >= 2) syncQuestIfNeeded();
      }
    } catch (err) {
      console.error('Practice check error:', err);
      toast.error("Tekshirishda xatolik. Qayta urinib ko'ring.");
    }
  };

  const handleNextRound = () => {
    setActiveRound(null);
    setPrompt(null);
    setSentence('');
    setFeedback(null);
  };

  if (isLoading) {
    return <div className="text-center py-20 animate-pulse">Amaliyot yuklanmoqda...</div>;
  }

  if (!rounds.length) {
    return (
      <div className="text-center py-20 bg-card border border-dashed border-border rounded-3xl max-w-2xl mx-auto px-6">
        <div className="text-5xl mb-4">✍️</div>
        <h2 className="text-2xl font-bold mb-4">Amaliyot uchun so'zlar yo'q</h2>
        <p className="text-muted-foreground mb-6">
          Bugun, kecha yoki avvalgi kunlarda o'rganilgan so'zlar shu yerda ishlatiladi.
        </p>
        <Link
          to="/topic"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-full"
        >
          Yangi so'z o'rganish →
        </Link>
      </div>
    );
  }

  if (!activeRound) {
    return (
      <div className="max-w-3xl mx-auto animate-fade-in">
        <div className="mb-8 text-center">
          <h2 className="text-2xl md:text-4xl font-black bg-gradient-to-r from-teal-500 to-emerald-500 bg-clip-text text-transparent mb-3">
            Amaliyot — Active Recall ✍️
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Yodlangan so'zlaringiz bilan haqiqiy vaziyatda gap tuzasiz. AI jumlani tekshiradi
            (bugun → kecha → avvalgi kunlar).
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-8 text-center text-sm">
            <div className="bg-card border border-border rounded-xl p-3">
              <p className="font-black text-teal-500">{stats.today}</p>
              <p className="text-muted-foreground text-xs">Bugun</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3">
              <p className="font-black text-teal-500">{stats.yesterday}</p>
              <p className="text-muted-foreground text-xs">Kecha</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-3">
              <p className="font-black text-teal-500">{stats.older}</p>
              <p className="text-muted-foreground text-xs">Avvalgi</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {rounds.map((round) => (
            <button
              key={round.roundIndex}
              type="button"
              onClick={() => startRound(round)}
              className="w-full text-left p-5 rounded-2xl border-2 border-border bg-card hover:border-teal-500/50 hover:bg-teal-500/5 transition-all"
            >
              <p className="text-xs font-bold uppercase text-teal-600 mb-1">{round.bucketLabel}</p>
              <p className="font-bold text-lg mb-2 flex items-center gap-2">
                <PenLine className="w-5 h-5" />
                {round.words.length} ta so'z bilan gap yozish
              </p>
              <div className="flex flex-wrap gap-2">
                {round.words.map((w) => (
                  <span
                    key={w._id}
                    className="text-xs font-bold px-2 py-1 rounded-full bg-secondary capitalize"
                  >
                    {w.word}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {completedRounds >= 2 && (
          <p className="mt-6 text-center text-sm font-bold text-green-500 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Kunlik amaliyot bajarildi!
          </p>
        )}
      </div>
    );
  }

  const targetWords = prompt?.targetWords || activeRound.words.map((w) => w.word);

  return (
    <div className="max-w-2xl mx-auto px-4 animate-fade-in">
      <button
        type="button"
        onClick={handleNextRound}
        className="mb-6 text-muted-foreground flex items-center gap-2"
      >
        <ChevronLeft className="w-4 h-4" /> Bosh menyu
      </button>

      <p className="text-xs font-bold uppercase text-teal-600 mb-2">{activeRound.bucketLabel}</p>

      <div className="bg-card border border-border rounded-3xl p-6 shadow-lg mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {activeRound.words.map((w) => (
            <button
              key={w._id}
              type="button"
              onClick={() => playTTSAudio(w.word, 'en-GB', 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold capitalize text-sm"
            >
              {w.word}
              <Volume2 className="w-3 h-3" />
            </button>
          ))}
        </div>

        {loadingPrompt ? (
          <p className="text-muted-foreground animate-pulse">AI vaziyat tayyorlanmoqda...</p>
        ) : (
          <>
            <p className="text-lg font-medium leading-relaxed">{prompt?.promptUz}</p>
            {prompt?.miniTipUz && (
              <p className="text-sm text-muted-foreground mt-3 flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-teal-500" />
                {prompt.miniTipUz}
              </p>
            )}
          </>
        )}

        <p className="text-xs text-muted-foreground mt-4">
          Maqsad: {targetWords.join(', ')}
        </p>
      </div>

      {!feedback ? (
        <div className="space-y-4">
          <textarea
            className="w-full bg-background border-2 border-border focus:border-teal-500 rounded-2xl p-4 text-lg min-h-[120px] outline-none resize-none"
            rows={4}
            placeholder="Ingliz tilida gap yozing..."
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleCheck())}
          />
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking || !sentence.trim() || loadingPrompt}
            className="w-full py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 disabled:opacity-50"
          >
            {checking ? 'Tekshirilmoqda...' : 'Jumlani tekshirish ✨'}
          </button>
        </div>
      ) : (
        <div
          className={`p-6 rounded-2xl border ${
            feedback.isCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-destructive/10 border-destructive/30'
          }`}
        >
          <p className="mb-4 font-medium">{feedback.feedback}</p>
          {feedback.wordsUsed && (
            <div className="flex flex-wrap gap-2 mb-4 text-xs">
              {Object.entries(feedback.wordsUsed).map(([word, ok]) => (
                <span
                  key={word}
                  className={`px-2 py-1 rounded-full font-bold ${ok ? 'bg-green-500/20 text-green-700' : 'bg-muted text-muted-foreground'}`}
                >
                  {word}: {ok ? '✓' : '—'}
                </span>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleNextRound}
            className="w-full py-3 rounded-xl font-bold bg-secondary"
          >
            Keyingi bosqich →
          </button>
        </div>
      )}
    </div>
  );
};

export default PracticeMode;
