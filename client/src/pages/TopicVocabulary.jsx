import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  useGetCurrentTopicQuery,
  useGetTopicBacklogQuery,
  useFinishTopicDayMutation,
  useAddWordMutation,
  useGetWordsQuery,
  useGetMeQuery,
} from '../features/api/apiSlice';
import { setCredentials } from '../features/auth/authSlice';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  CheckCircle2,
  Volume2,
  PlusCircle,
  ArrowRight,
  ChevronLeft,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { playTTSAudio } from '../utils/audio';
import { getDailyWordTarget } from '../utils/learningUtils';
import { fireConfetti } from '../utils/celebration';

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);
const QUIZ_KEY = 'linguist_topic_quiz_passed';

const FALLBACK_OPTIONS = ['Boshqa ma\'no', 'Noto\'g\'ri tarjima', 'Aksincha', 'Tanilmadi'];

const TopicQuiz = ({ pack, onPass, onBack }) => {
  const questions = useMemo(
    () =>
      pack.map((w) => {
        const wrongFromPack = pack
          .filter((x) => x.word !== w.word)
          .map((x) => x.translation)
          .filter(Boolean);
        const wrong = shuffle([...wrongFromPack, ...FALLBACK_OPTIONS]).slice(0, 3);
        const options = shuffle([w.translation, ...wrong].filter(Boolean).slice(0, 4));
        return { word: w.word, correct: w.translation, options };
      }),
    [pack]
  );

  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [selected, setSelected] = useState(null);

  const q = questions[idx];
  if (!q) return null;

  const handlePick = (opt) => {
    if (selected) return;
    setSelected(opt);
    const isOk = opt === q.correct;
    setTimeout(() => {
      const newCorrect = isOk ? correct + 1 : correct;
      if (idx < questions.length - 1) {
        setCorrect(newCorrect);
        setIdx((i) => i + 1);
        setSelected(null);
      } else {
        const score = Math.round((newCorrect / questions.length) * 100);
        if (score >= 60) onPass(score);
        else {
          toast.error(`Natija ${score}%. Kamida 60% kerak — qayta urinib ko'ring.`);
          setIdx(0);
          setCorrect(0);
          setSelected(null);
        }
      }
    }, 700);
  };

  return (
    <div className="max-w-lg mx-auto">
      <button type="button" onClick={onBack} className="text-sm text-muted-foreground mb-4 flex items-center gap-1">
        <ChevronLeft className="w-4 h-4" /> Orqaga
      </button>
      <p className="text-sm font-bold text-muted-foreground mb-2">
        Mini-test {idx + 1}/{questions.length}
      </p>
      <h3 className="text-2xl font-black mb-6 capitalize">{q.word}</h3>
      <div className="space-y-3">
        {q.options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => handlePick(opt)}
            disabled={!!selected}
            className={`w-full text-left p-4 rounded-xl border font-medium ${
              selected === opt
                ? opt === q.correct
                  ? 'border-green-500 bg-green-500/10'
                  : 'border-destructive bg-destructive/10'
                : 'border-border hover:border-purple-500/50'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

const TopicVocabulary = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = useSelector((s) => s.auth.token);
  const { data: topicData, isLoading } = useGetCurrentTopicQuery();
  const { data: backlogData } = useGetTopicBacklogQuery(undefined, { skip: !topicData });
  const { data: user } = useGetMeQuery();
  const [finishTopicDay, { isLoading: isFinishing }] = useFinishTopicDayMutation();
  const [addWord] = useAddWordMutation();
  const { data: userWords = [] } = useGetWordsQuery();

  const [step, setStep] = useState('intro');
  const [addingWords, setAddingWords] = useState({});
  const [quizPassed, setQuizPassed] = useState(() => sessionStorage.getItem(QUIZ_KEY) === '1');
  const [showBacklog, setShowBacklog] = useState(false);
  const healRef = useRef(false);

  const pack = topicData?.words || [];
  const wordTarget = topicData?.wordTarget ?? user?.dailyWordTarget ?? getDailyWordTarget(user?.onboarding?.level);
  const requiredCount = topicData?.requiredCount ?? Math.min(wordTarget, pack.length || wordTarget);

  const packSavedCount = useMemo(() => {
    if (topicData?.packSavedCount != null) return topicData.packSavedCount;
    const saved = new Set(userWords.map((w) => w.word.toLowerCase()));
    return pack.filter((w) => saved.has(w.word.toLowerCase())).length;
  }, [topicData, pack, userWords]);

  const canFinish = pack.length === 0 ? true : quizPassed && packSavedCount >= requiredCount;

  const applyUserUpdate = useCallback(
    (profile) => {
      if (profile && token) {
        dispatch(setCredentials({ user: profile, token }));
      }
    },
    [dispatch, token]
  );

  const handleFinishDay = useCallback(async () => {
    try {
      const res = await finishTopicDay({ quizPassed: pack.length === 0 ? true : quizPassed }).unwrap();
      applyUserUpdate(res.user);
      sessionStorage.removeItem(QUIZ_KEY);
      fireConfetti();
      toast.success(res.message || 'Kunlik sahna bajarildi!');
      setStep('done');
    } catch (err) {
      const msg = err?.data?.error || 'Yakunlashda xatolik';
      toast.error(msg);
    }
  }, [finishTopicDay, quizPassed, pack.length, applyUserUpdate]);

  useEffect(() => {
    if (topicData?.topicQuestCompleted && step !== 'done') {
      setStep('done');
    }
  }, [topicData?.topicQuestCompleted, step]);

  useEffect(() => {
    if (healRef.current || isLoading || !topicData) return;
    if (topicData.isCompleteForToday && !topicData.topicQuestCompleted) {
      healRef.current = true;
      handleFinishDay();
    }
  }, [topicData, isLoading, handleFinishDay]);

  const handleAddWordToDict = async (wordObj) => {
    setAddingWords((prev) => ({ ...prev, [wordObj.word]: true }));
    try {
      await addWord({
        word: wordObj.word,
        skipAI: true,
        fromTopic: true,
        manualTranslation: wordObj.translation,
        manualDefinition: wordObj.definition,
        manualExamples: [wordObj.example],
        partOfSpeech: wordObj.partOfSpeech,
        synonyms: [],
      }).unwrap();
      toast.success(`"${wordObj.word}" saqlandi — takrorlashda chiqadi`);
    } catch (error) {
      if (error?.data?.type === 'DUPLICATE' || error?.data?.message?.includes('already')) {
        toast.success(`"${wordObj.word}" allaqachon lug'atingizda`);
      } else {
        toast.error("So'zni qo'shishda xatolik.");
      }
    } finally {
      setAddingWords((prev) => ({ ...prev, [wordObj.word]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Bugungi sahna yuklanmoqda...</p>
      </div>
    );
  }

  if (topicData?.isFinished) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <div className="text-6xl mb-6">🏆</div>
        <h2 className="text-3xl font-black mb-4">Barcha mavzular tugadi!</h2>
        <Link to="/" className="text-primary font-bold">
          Bosh sahifa →
        </Link>
      </div>
    );
  }

  if (!topicData) {
    return <div className="text-center p-12">Sahifani yangilab ko'ring.</div>;
  }

  if (step === 'done' || topicData.topicQuestCompleted) {
    return (
      <div className="max-w-lg mx-auto text-center py-12 px-4">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-black mb-2">Kunlik sahna bajarildi!</h2>
        <p className="text-muted-foreground mb-8">Dashboard’da keyingi qadam: Takrorlash</p>
        <div className="flex flex-col gap-3">
          <Button size="lg" className="rounded-full font-bold" onClick={() => navigate('/')}>
            Bosh sahifaga qaytish
          </Button>
          <Link to="/review" className="text-primary font-bold text-sm">
            Takrorlashga o'tish →
          </Link>
        </div>
      </div>
    );
  }

  const progressPercent = requiredCount > 0 ? Math.min(100, Math.round((packSavedCount / requiredCount) * 100)) : 100;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
      <div className="text-center mb-4 sm:mb-6">
        <p className="text-xs font-bold uppercase text-purple-500">Kunlik sahna · 1-qadam</p>
        <h1 className="text-2xl sm:text-3xl font-black mt-1">Bugungi mavzu</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Saqlangan: {packSavedCount}/{requiredCount}
          {quizPassed ? ' · Test ✓' : ' · Test kerak'}
        </p>
      </div>

      <div className="h-2 bg-secondary rounded-full mb-8 overflow-hidden">
        <div className="h-full bg-purple-500 transition-all" style={{ width: `${progressPercent}%` }} />
      </div>

      {step === 'intro' && (
        <div className="bg-card border rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-center">
          <div className="text-4xl sm:text-6xl mb-3 sm:mb-4">{topicData.scenarioEmoji || '📚'}</div>
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">{topicData.topicUz || topicData.topic}</h2>
          <p className="text-foreground mb-4 leading-relaxed">{topicData.story}</p>
          <p className="text-sm text-muted-foreground mb-8">
            Ketma-ketlik: o'rganish → mini-test → {requiredCount} ta so'z saqlash → takrorlash
          </p>
          {pack.length === 0 ? (
            <Button size="lg" onClick={handleFinishDay} disabled={isFinishing}>
              {isFinishing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kunlik sahni yakunlash'}
            </Button>
          ) : (
            <Button size="lg" onClick={() => setStep('learn')}>
              Boshlash <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      )}

      {step === 'learn' && (
        <>
          <div className="space-y-4 mb-6">
            {pack.map((w, index) => {
              const saved = userWords.some((uw) => uw.word.toLowerCase() === w.word.toLowerCase());
              return (
                <div key={index} className="bg-card border rounded-2xl p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        {w.word}
                        <button type="button" onClick={() => playTTSAudio(w.word, 'en-GB', 1.0)}>
                          <Volume2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </h3>
                      <p className="text-sm font-bold text-green-600 mt-2">{w.translation}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={saved || addingWords[w.word]}
                      onClick={() => handleAddWordToDict(w)}
                      className={saved ? 'text-green-500' : ''}
                    >
                      {addingWords[w.word] ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : saved ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <PlusCircle className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3 justify-between">
            <Button variant="outline" onClick={() => setStep('intro')}>
              Orqaga
            </Button>
            {!quizPassed && pack.length > 0 && (
              <Button onClick={() => setStep('quiz')} className="font-bold">
                Mini-testga o'tish <Sparkles className="w-4 h-4 ml-2" />
              </Button>
            )}
            {canFinish && (
              <Button onClick={handleFinishDay} disabled={isFinishing} className="bg-green-600 hover:bg-green-500">
                {isFinishing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sahnani yakunlash ✓'}
              </Button>
            )}
          </div>
          {!canFinish && quizPassed && packSavedCount < requiredCount && (
            <p className="text-center text-sm text-amber-600 mt-4 font-medium">
              Yana {requiredCount - packSavedCount} ta so'z saqlang, keyin "Sahnani yakunlash"
            </p>
          )}
        </>
      )}

      {step === 'quiz' && (
        <div className="bg-card border rounded-3xl p-6">
          <TopicQuiz
            pack={pack}
            onPass={() => {
              setQuizPassed(true);
              sessionStorage.setItem(QUIZ_KEY, '1');
              toast.success('Test o\'tdi!');
              setStep('learn');
            }}
            onBack={() => setStep('learn')}
          />
        </div>
      )}

      {topicData.backlogCount > 0 && step === 'intro' && (
        <button
          type="button"
          className="w-full text-center text-xs text-muted-foreground mt-4"
          onClick={() => setShowBacklog(!showBacklog)}
        >
          Qarzdorlik: {topicData.backlogCount} so'z {showBacklog ? '▲' : '▼'}
        </button>
      )}
    </div>
  );
};

export default TopicVocabulary;
