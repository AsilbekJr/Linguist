import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  useGetReviewDueQuery,
  useGetWordsQuery,
  useCheckReviewMutation,
  useGradeReviewMutation,
  useSyncDailyQuestMutation,
} from '../features/api/apiSlice';
import { groupWordsByReviewInterval } from '../utils/dateUtils';
import { ChevronLeft, Mic, MicOff, Volume2, Layers, ListChecks, PenLine } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { playTTSAudio } from '../utils/audio';
import { fireConfetti } from '../utils/celebration';

const MODES = [
  { id: 'flashcard', label: 'Flashcard', icon: Layers, desc: 'So\'z ↔ ma\'no, tez takrorlash' },
  { id: 'quiz', label: 'Variantli savol', icon: ListChecks, desc: '4 tarjimadan to\'g\'risini tanlang' },
  { id: 'sentence', label: 'Jumla yozish', icon: PenLine, desc: 'AI bilan jumlada tekshirish' },
];

/** Fisher–Yates — `sort(() => Math.random() - 0.5)` statistik jihatdan nosimmetrik aralashtiradi */
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** SM-2 baholari — server utils/srs.js dagi GRADE bilan bir xil */
const GRADES = [
  { grade: 0, label: 'Eslay olmadim', hint: 'So\'z shu sessiyada qayta chiqadi', className: 'border-destructive/50 text-destructive hover:bg-destructive/10' },
  { grade: 1, label: 'Qiyin', hint: 'Qiynalib esladim — tez-tez qaytadi', className: 'border-orange-500/50 text-orange-600 hover:bg-orange-500/10' },
  { grade: 2, label: 'Esladim', hint: 'Normal', className: 'border-green-600/50 text-green-600 hover:bg-green-600/10' },
  { grade: 3, label: 'Juda oson', hint: 'Uzoq vaqtdan keyin qaytadi', className: 'border-blue-500/50 text-blue-600 hover:bg-blue-500/10' },
];

const ReviewMode = () => {
  const { data: dueWords = [], isLoading: loadingDue } = useGetReviewDueQuery();
  const { data: allWords = [], isLoading: loadingWords } = useGetWordsQuery();
  const [checkReviewMutation] = useCheckReviewMutation();
  const [gradeReview] = useGradeReviewMutation();
  const [syncDailyQuest] = useSyncDailyQuestMutation();

  const [activeMode, setActiveMode] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [sessionWords, setSessionWords] = useState([]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [userSentence, setUserSentence] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [checking, setChecking] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [sessionResults, setSessionResults] = useState({ correct: 0, incorrect: 0 });
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState(null);
  const [error, setError] = useState(null);

  const [flipped, setFlipped] = useState(false);
  const [quizOptions, setQuizOptions] = useState([]);
  const [quizAnswered, setQuizAnswered] = useState(null);
  const [lastInterval, setLastInterval] = useState(null);

  const autoAdvanceTimeoutRef = useRef(null);
  const questSyncedRef = useRef(false);

  const totalWords = allWords.length;
  const isLoading = loadingDue || loadingWords;

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event) => {
        let finalTrans = '';
        let interimTrans = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTrans += event.results[i][0].transcript;
          else interimTrans += event.results[i][0].transcript;
        }
        setUserSentence(finalTrans || interimTrans);
      };

      rec.onend = () => setIsListening(false);
      rec.onerror = () => {
        setIsListening(false);
        setError("Microphone error. Please try again or type.");
      };

      setRecognition(rec);
    }
  }, []);

  const groupedWords = useMemo(() => groupWordsByReviewInterval(dueWords), [dueWords]);

  const buildQuizOptions = (word, pool) => {
    const wrong = shuffle(
      pool.filter((w) => w._id !== word._id && w.translation).map((w) => w.translation)
    ).slice(0, 3);
    const correct = word.translation || word.definition || word.word;
    return shuffle([correct, ...wrong].filter(Boolean).slice(0, 4));
  };

  const finishSession = () => {
    if (!questSyncedRef.current) {
      questSyncedRef.current = true;
      syncDailyQuest({ type: 'review' })
        .unwrap()
        .then((res) => {
          if (res.xpAwarded) toast.success(res.message || `+${res.xpAwarded} XP`);
          if (res.streakUpdated) {
            fireConfetti();
            toast.success(res.message, { icon: '🔥' });
          }
        })
        .catch((err) => console.error('Failed to sync quest:', err));
    }
    setSessionWords([]);
    setSelectedGroup(null);
    setActiveMode(null);
    setFlipped(false);
    setQuizAnswered(null);
  };

  /**
   * @param {number} grade 0=Again, 1=Hard, 2=Good, 3=Easy
   * Ilgari faqat "bildim/bilmadim" bor edi. SM-2 ning ease factor'i aynan
   * shu farqdan oziqlanadi: qiynalib eslangan so'z tez-tez, oson eslangan
   * so'z kamroq qaytadi.
   */
  const advanceWithGrade = async (grade) => {
    const currentWord = sessionWords[currentIndex];
    try {
      const res = await gradeReview({ id: currentWord._id, grade }).unwrap();
      setSessionResults((prev) => ({
        ...prev,
        [grade > 0 ? 'correct' : 'incorrect']: prev[grade > 0 ? 'correct' : 'incorrect'] + 1,
      }));
      setLastInterval(res.intervalDays);
    } catch (err) {
      console.error('Grade review error:', err);
      setError('Saqlashda xatolik. Qayta urinib ko\'ring.');
      return;
    }

    setFlipped(false);
    setQuizAnswered(null);
    if (currentIndex < sessionWords.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      if (activeMode === 'quiz') {
        setQuizOptions(buildQuizOptions(sessionWords[nextIdx], allWords));
      }
    } else {
      finishSession();
    }
  };

  const startReviewSession = (groupName, wordsInGroup, mode) => {
    setSelectedGroup(groupName);
    setSessionWords(wordsInGroup);
    setActiveMode(mode);
    setCurrentIndex(0);
    setUserSentence('');
    setFeedback(null);
    setError(null);
    setShowHint(false);
    setSessionResults({ correct: 0, incorrect: 0 });
    setFlipped(false);
    setQuizAnswered(null);
    questSyncedRef.current = false;
    if (mode === 'quiz' && wordsInGroup[0]) {
      setQuizOptions(buildQuizOptions(wordsInGroup[0], allWords));
    }
  };

  const toggleListening = () => {
    if (!recognition) {
      setError("Your browser doesn't support speech recognition.");
      return;
    }
    if (isListening) recognition.stop();
    else {
      setError(null);
      recognition.start();
      setIsListening(true);
    }
  };

  const handleCheck = async () => {
    if (!userSentence.trim()) return;
    setChecking(true);
    setError(null);
    const currentWord = sessionWords[currentIndex];
    try {
      const data = await checkReviewMutation({ id: currentWord._id, sentence: userSentence }).unwrap();
      setFeedback(data);
      setSessionResults((prev) => ({
        ...prev,
        [data.isCorrect ? 'correct' : 'incorrect']: prev[data.isCorrect ? 'correct' : 'incorrect'] + 1,
      }));
      if (data.isCorrect) {
        autoAdvanceTimeoutRef.current = setTimeout(() => handleNext(), 2500);
      }
    } catch (err) {
      // AI javob bermadi (503). Muhim: bu holatda server takrorlash holatini
      // O'ZGARTIRMAGAN. Foydalanuvchiga aynan shuni aytamiz — ilgari uning
      // to'g'ri gapi "xato" deb belgilanib, pog'onasi pasayardi.
      if (err?.status === 503 && err?.data?.srsUnchanged) {
        setError(
          err.data.message ||
            "AI hozir javob bera olmadi. Takrorlash holatingiz o'zgarmadi — biroz kutib qayta urinib ko'ring."
        );
      } else {
        console.error('Check error:', err);
        setError("Server xatosi: javob olib bo'lmadi. Qayta urinib ko'ring.");
      }
    } finally {
      setChecking(false);
    }
  };

  const handleNext = () => {
    if (autoAdvanceTimeoutRef.current) {
      clearTimeout(autoAdvanceTimeoutRef.current);
      autoAdvanceTimeoutRef.current = null;
    }
    setFeedback(null);
    setUserSentence('');
    setError(null);
    setShowHint(false);
    if (isListening && recognition) recognition.stop();
    if (currentIndex < sessionWords.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      finishSession();
    }
  };

  if (isLoading) return <div className="text-center py-20 animate-pulse">Yuklanmoqda...</div>;

  if (!selectedGroup) {
    const groupsEntries = Object.entries(groupedWords);

    if (totalWords === 0) {
      return (
        <div className="text-center py-20 bg-card border border-border border-dashed rounded-3xl max-w-2xl mx-auto px-6">
          <div className="text-5xl md:text-6xl mb-4">📚</div>
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Hali so'z qo'shmagansiz</h2>
          <p className="text-muted-foreground mb-6">
            Takrorlash uchun avval yangi so'zlar o'rganing — keyin bu yerda mashq qilasiz.
          </p>
          <Link
            to="/topic"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-full hover:opacity-90"
          >
            Yangi so'z o'rganish →
          </Link>
        </div>
      );
    }

    if (groupsEntries.length === 0) {
      return (
        <div className="text-center py-20 bg-card border border-border border-dashed rounded-3xl max-w-2xl mx-auto px-6">
          <div className="text-5xl md:text-6xl mb-4">🎉</div>
          <h2 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent mb-4">
            Bugungi takrorlash tugadi!
          </h2>
          <p className="text-muted-foreground">
            Hozircha takrorlash uchun so'zlar yo'q. Ertaga yoki yangi so'z qo'shganda qaytib keling.
          </p>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto animate-fade-in text-center">
        <div className="mb-10">
          <h2 className="text-2xl md:text-5xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent mb-4">
            Takrorlash ✨
          </h2>
          <p className="text-muted-foreground">Rejim tanlang, keyin guruhni boshlang.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 text-left">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.id} className="bg-card border border-border rounded-2xl p-4">
                <Icon className="w-6 h-6 text-pink-500 mb-2" />
                <h4 className="font-bold">{m.label}</h4>
                <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {groupsEntries.map(([groupName, wordsInGroup]) => {
            const isOverdue = groupName.includes('Overdue');
            return (
              <div key={groupName} className="bg-card rounded-3xl p-6 border shadow-md border-border">
                <h3 className="text-xl font-bold mb-2">{groupName}</h3>
                <p className="text-sm text-muted-foreground mb-4">{wordsInGroup.length} ta so'z</p>
                <div className="flex flex-wrap gap-2">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => startReviewSession(groupName, wordsInGroup, m.id)}
                      className={`text-xs font-bold px-3 py-2 rounded-full border transition-colors ${
                        isOverdue
                          ? 'border-destructive/50 text-destructive hover:bg-destructive/10'
                          : 'border-pink-500/50 text-pink-500 hover:bg-pink-500/10'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const word = sessionWords[currentIndex];

  if (!word) {
    const total = sessionResults.correct + sessionResults.incorrect;
    const accuracy = total > 0 ? Math.round((sessionResults.correct / total) * 100) : 0;
    return (
      <div className="text-center py-16 max-w-2xl mx-auto bg-card border border-border rounded-3xl shadow-xl animate-fade-in mt-12">
        <div className="text-5xl mb-6">🎉</div>
        <h2 className="text-2xl font-bold mb-4">Takrorlash yakunlandi!</h2>
        <p className="text-muted-foreground mb-6">{selectedGroup} · {accuracy}% aniqlik</p>
        <button
          type="button"
          onClick={() => setSelectedGroup(null)}
          className="px-8 py-3 bg-secondary font-bold rounded-full"
        >
          Bosh menyu
        </button>
      </div>
    );
  }

  if (activeMode === 'flashcard') {
    return (
      <div className="max-w-xl mx-auto px-4">
        <button type="button" onClick={finishSession} className="mb-6 text-muted-foreground flex items-center gap-2">
          <ChevronLeft className="w-4 h-4" /> Chiqish
        </button>
        <p className="text-sm font-bold text-muted-foreground mb-4">
          {currentIndex + 1} / {sessionWords.length}
        </p>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="w-full min-h-[220px] bg-card border-2 border-border rounded-3xl p-8 text-center hover:border-pink-500/50 transition-colors"
        >
          {!flipped ? (
            <>
              <p className="text-xs uppercase text-muted-foreground mb-2">So'z</p>
              <h3 className="text-4xl font-black capitalize">{word.word}</h3>
            </>
          ) : (
            <>
              <p className="text-xs uppercase text-muted-foreground mb-2">Ma'no</p>
              <p className="text-lg font-medium">{word.translation || word.definition}</p>
            </>
          )}
        </button>
        {flipped && (
          <>
            <p className="text-xs text-center text-muted-foreground mt-6 mb-3">
              Qanchalik oson esladingiz?
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {GRADES.map((g) => (
                <button
                  key={g.grade}
                  type="button"
                  onClick={() => advanceWithGrade(g.grade)}
                  className={`py-3 px-2 rounded-xl border-2 font-bold text-sm transition-colors ${g.className}`}
                  title={g.hint}
                >
                  {g.label}
                </button>
              ))}
            </div>
            {lastInterval !== null && (
              <p className="text-center text-xs text-muted-foreground mt-3">
                Oldingi so'z {lastInterval === 0 ? 'shu sessiyada' : `${lastInterval} kundan keyin`} qaytadi
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  if (activeMode === 'quiz') {
    return (
      <div className="max-w-xl mx-auto px-4">
        <button type="button" onClick={finishSession} className="mb-6 text-muted-foreground flex items-center gap-2">
          <ChevronLeft className="w-4 h-4" /> Chiqish
        </button>
        <p className="text-sm font-bold mb-2">
          {currentIndex + 1} / {sessionWords.length}
        </p>
        <h3 className="text-3xl font-black capitalize mb-6">{word.word}</h3>
        <p className="text-sm text-muted-foreground mb-4">To'g'ri tarjimani tanlang:</p>
        <div className="space-y-3">
          {quizOptions.map((opt) => {
            const correct = word.translation || word.definition;
            const isCorrect = opt === correct;
            const showResult = quizAnswered !== null;
            return (
              <button
                key={opt}
                type="button"
                disabled={quizAnswered !== null}
                onClick={() => {
                  setQuizAnswered(opt);
                  setTimeout(() => advanceWithGrade(isCorrect ? 2 : 0), 800);
                }}
                className={`w-full text-left p-4 rounded-xl border font-medium transition-colors ${
                  showResult && isCorrect
                    ? 'border-green-500 bg-green-500/10'
                    : showResult && quizAnswered === opt && !isCorrect
                      ? 'border-destructive bg-destructive/10'
                      : 'border-border hover:border-primary/50'
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 animate-fade-in">
      <button
        type="button"
        onClick={finishSession}
        className="mb-8 text-muted-foreground hover:text-foreground flex items-center gap-2 font-medium bg-secondary px-4 py-2 rounded-lg"
      >
        <ChevronLeft className="w-4 h-4" /> Chiqish
      </button>

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">{selectedGroup} · Jumla</h2>
        <span className="text-sm bg-muted px-3 py-1 rounded-full font-bold">
          {currentIndex + 1} / {sessionWords.length}
        </span>
      </div>

      <div className="bg-card p-8 rounded-3xl border border-border shadow-2xl">
        <div className="text-center mb-8">
          {error && <div className="text-destructive mb-4 text-sm">{error}</div>}
          <div className="flex justify-center items-center gap-4 mb-4">
            <h3 className="text-4xl font-black capitalize">{word.word}</h3>
            <button
              type="button"
              onClick={() => playTTSAudio(word.word, 'en-GB', 1.0)}
              className="p-2 bg-pink-500/10 text-pink-500 rounded-full"
            >
              <Volume2 className="w-6 h-6" />
            </button>
          </div>
          <p className="text-muted-foreground italic">"{word.definition}"</p>
        </div>

        {!feedback ? (
          <div className="space-y-4">
            <div className="relative">
              <textarea
                className={`w-full bg-background border rounded-xl p-4 pr-16 text-lg outline-none resize-none ${
                  isListening ? 'border-orange-500' : 'border-border focus:border-pink-500'
                }`}
                rows="3"
                placeholder="Gapingizni yozing..."
                value={userSentence}
                onChange={(e) => setUserSentence(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleCheck()}
              />
              <button
                type="button"
                onClick={toggleListening}
                className="absolute bottom-4 right-4 p-3 rounded-full bg-secondary"
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            </div>
            {!showHint ? (
              <button type="button" onClick={() => setShowHint(true)} className="text-sm text-pink-500 font-bold">
                💡 Yordam
              </button>
            ) : (
              <p className="text-sm font-bold">{word.translation || '—'}</p>
            )}
            <button
              type="button"
              onClick={handleCheck}
              disabled={checking || !userSentence.trim()}
              className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl font-bold text-white disabled:opacity-50"
            >
              {checking ? 'Tekshirilmoqda...' : 'Tekshirish ✨'}
            </button>
          </div>
        ) : (
          <div className={`p-6 rounded-2xl border ${feedback.isCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-destructive/10 border-destructive/30'}`}>
            <p className="mb-3">{feedback.feedback}</p>

            {feedback.usedTargetWord === false && (
              <p className="text-sm font-bold text-amber-600 mb-3">
                Diqqat: &quot;{word.word}&quot; so&apos;zi gapda ishlatilmagan.
              </p>
            )}

            {feedback.corrected && (
              <div className="mb-4 p-3 rounded-xl bg-background border border-border">
                <p className="text-xs uppercase text-muted-foreground mb-1">To&apos;g&apos;ri variant</p>
                <p className="font-medium">{feedback.corrected}</p>
              </div>
            )}

            {feedback.intervalDays != null && (
              <p className="text-xs text-muted-foreground mb-4">
                {feedback.intervalDays === 0
                  ? "Bu so'z shu sessiyada qayta chiqadi"
                  : `Keyingi takrorlash: ${feedback.intervalDays} kundan keyin`}
              </p>
            )}

            <button type="button" onClick={handleNext} className="w-full py-3 rounded-xl font-bold bg-secondary">
              {currentIndex < sessionWords.length - 1 ? 'Keyingi →' : 'Yakunlash'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewMode;
