import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  useGetCurrentTopicQuery,
  useGetTopicBacklogQuery,
  useStartTopicQuizMutation,
  useSubmitTopicQuizMutation,
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
  Headphones,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { playTTSAudio } from '../utils/audio';
import { getDailyWordTarget } from '../utils/learningUtils';
import { fireConfetti } from '../utils/celebration';

/**
 * Mini-test.
 *
 * Ilgari savollar ham, to'g'ri javob ham shu komponentda edi va natija
 * `sessionStorage` ga yozilardi — DevTools'dan bitta qator bilan butun kunni
 * o'tkazib yuborish mumkin edi. Chalg'ituvchi variantlar esa
 * ['Boshqa ma'no', 'Noto'g'ri tarjima', ...] kabi shablonlar edi: foydalanuvchi
 * bir necha savoldan keyin so'zni bilmasdan ham 100% to'plardi.
 *
 * Endi savollar serverdan keladi, to'g'ri javob mijozga umuman yuborilmaydi,
 * baholash ham serverda bo'ladi.
 */
const TopicQuiz = ({ quiz, onPass, onBack, submitQuiz, isSubmitting }) => {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState(null);

  const questions = quiz?.questions || [];
  const q = questions[idx];

  const finish = async (finalAnswers) => {
    try {
      const res = await submitQuiz({ quizId: quiz.quizId, answers: finalAnswers }).unwrap();
      setResults(res);
      if (res.passed) {
        toast.success(`Test o'tdi — ${res.score}%`);
        onPass(res);
      } else {
        toast.error(`Natija ${res.score}%. Kamida ${res.passPercent}% kerak.`);
      }
    } catch {
      toast.error("Testni tekshirishda xatolik. Qayta urinib ko'ring.");
    }
  };

  const handlePick = (optionIndex) => {
    if (selected !== null || isSubmitting) return;
    setSelected(optionIndex);
    const next = [...answers, optionIndex];

    setTimeout(() => {
      setAnswers(next);
      if (idx < questions.length - 1) {
        setIdx((i) => i + 1);
        setSelected(null);
      } else {
        finish(next);
      }
    }, 400);
  };

  const retry = () => {
    setIdx(0);
    setAnswers([]);
    setSelected(null);
    setResults(null);
    onBack();
  };

  if (results && !results.passed) {
    return (
      <div className="max-w-lg mx-auto text-center">
        <div className="text-4xl mb-3">📚</div>
        <h3 className="text-xl font-bold mb-2">Natija: {results.score}%</h3>
        <p className="text-muted-foreground mb-6">
          O'tish uchun {results.passPercent}% kerak. So'zlarni qayta ko'rib chiqing.
        </p>
        <div className="space-y-2 text-left mb-6">
          {results.results.filter((r) => !r.correct).map((r) => (
            <div key={r.word} className="p-3 rounded-xl border border-destructive/30 bg-destructive/5">
              <span className="font-bold capitalize">{r.word}</span>
              <span className="text-muted-foreground"> — {r.correctAnswer}</span>
            </div>
          ))}
        </div>
        <Button onClick={retry} className="rounded-full font-bold">
          So'zlarga qaytish
        </Button>
      </div>
    );
  }

  if (!q) return null;

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
        {q.options.map((opt, optionIndex) => (
          <button
            key={opt}
            type="button"
            onClick={() => handlePick(optionIndex)}
            disabled={selected !== null || isSubmitting}
            className={`w-full text-left p-4 rounded-xl border font-medium transition-colors ${
              selected === optionIndex
                ? 'border-primary bg-primary/10'
                : 'border-border hover:border-purple-500/50'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
      {isSubmitting && (
        <p className="text-center text-sm text-muted-foreground mt-4">Tekshirilmoqda...</p>
      )}
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
  const [startQuiz, { isLoading: isStartingQuiz }] = useStartTopicQuizMutation();
  const [submitQuiz, { isLoading: isSubmittingQuiz }] = useSubmitTopicQuizMutation();
  const [addWord] = useAddWordMutation();
  const { data: userWords = [] } = useGetWordsQuery();

  const [step, setStep] = useState('intro');
  const [addingWords, setAddingWords] = useState({});
  const [quiz, setQuiz] = useState(null);
  const [showBacklog, setShowBacklog] = useState(false);
  const healRef = useRef(false);

  // Test o'tilgani SERVERDAN keladi. Ilgari bu sessionStorage'da edi.
  const quizPassed = Boolean(topicData?.quizPassed);
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
      // Test natijasini server o'zi tekshiradi — mijoz `quizPassed` yubormaydi
      const res = await finishTopicDay({}).unwrap();
      applyUserUpdate(res.user);
      fireConfetti();
      toast.success(res.message || 'Kunlik sahna bajarildi!');
      setStep('done');
    } catch (err) {
      const msg = err?.data?.error || 'Yakunlashda xatolik';
      toast.error(msg);
      if (err?.data?.code === 'QUIZ_REQUIRED') setStep('learn');
    }
  }, [finishTopicDay, applyUserUpdate]);

  const handleStartQuiz = useCallback(async () => {
    try {
      const res = await startQuiz().unwrap();
      setQuiz(res);
      setStep('quiz');
    } catch (err) {
      toast.error(err?.data?.error || "Testni boshlashda xatolik");
    }
  }, [startQuiz]);

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
          {topicData.dialogue?.length > 0 && (
            <div className="bg-card border rounded-2xl p-4 sm:p-6 mb-6">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <h3 className="font-bold flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-500" />
                  Dialog
                </h3>
                <div className="flex items-center gap-2">
                  {topicData.cefr && (
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-purple-500/10 text-purple-600">
                      {topicData.cefr}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      playTTSAudio(topicData.dialogue.map((l) => l.en).join(' '), 'en-GB', 0.9)
                    }
                    className="text-xs font-bold text-purple-600 flex items-center gap-1"
                  >
                    <Volume2 className="w-4 h-4" /> Eshitish
                  </button>
                </div>
              </div>

              {topicData.grammarFocus && (
                <p className="text-xs text-muted-foreground mb-4 px-3 py-2 rounded-lg bg-secondary/60">
                  <span className="font-bold">Grammatika:</span> {topicData.grammarFocus}
                </p>
              )}

              <div className="space-y-3">
                {topicData.dialogue.map((line, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-xs font-bold text-muted-foreground shrink-0 w-16 pt-1 truncate">
                      {line.speaker}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{line.en}</p>
                      <p className="text-sm text-muted-foreground">{line.uz}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => playTTSAudio(line.en, 'en-GB', 0.9)}
                      className="shrink-0 text-muted-foreground hover:text-foreground self-start pt-1"
                      aria-label="Tinglash"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Dialogni o'qigach — uni tinglab yozib ko'rish. Bu ilovadagi
                  yagona input mashqi va aynan shu joyda tabiiy tushadi. */}
              <Link
                to="/listening"
                className="mt-5 flex items-center justify-between gap-3 p-3 rounded-xl border border-teal-500/30 bg-teal-500/5 hover:bg-teal-500/10 transition-colors"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-teal-700 dark:text-teal-300">
                  <Headphones className="w-4 h-4" />
                  Shu dialogni tinglab yozib ko&apos;ring
                </span>
                <ArrowRight className="w-4 h-4 text-teal-600 shrink-0" />
              </Link>
            </div>
          )}

          <div className="space-y-4 mb-6">
            {pack.map((w, index) => {
              const saved = userWords.some((uw) => uw.word.toLowerCase() === w.word.toLowerCase());
              return (
                <div key={index} className="bg-card border rounded-2xl p-5">
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <h3 className="text-xl font-bold flex items-center gap-2 flex-wrap">
                        <span className="capitalize">{w.word}</span>
                        <button type="button" onClick={() => playTTSAudio(w.word, 'en-GB', 1.0)} aria-label="Tinglash">
                          <Volume2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                        {w.phonetic && (
                          <span className="text-sm font-normal text-muted-foreground">{w.phonetic}</span>
                        )}
                        {w.partOfSpeech && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                            {w.partOfSpeech}
                          </span>
                        )}
                      </h3>
                      <p className="text-sm font-bold text-green-600 mt-2">{w.translation}</p>
                      {w.definition && (
                        <p className="text-sm text-muted-foreground mt-1">{w.definition}</p>
                      )}
                      {w.example && (
                        <div className="mt-3 pl-3 border-l-2 border-purple-500/30">
                          <p className="text-sm italic">{w.example}</p>
                          {w.exampleUz && (
                            <p className="text-xs text-muted-foreground">{w.exampleUz}</p>
                          )}
                        </div>
                      )}
                      {w.collocations?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {w.collocations.map((c) => (
                            <span key={c} className="text-[11px] px-2 py-1 rounded-full bg-secondary text-muted-foreground">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
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
              <Button onClick={handleStartQuiz} disabled={isStartingQuiz} className="font-bold">
                {isStartingQuiz ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Mini-testga o'tish <Sparkles className="w-4 h-4 ml-2" />
                  </>
                )}
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

      {step === 'quiz' && quiz && (
        <div className="bg-card border rounded-3xl p-6">
          <TopicQuiz
            quiz={quiz}
            submitQuiz={submitQuiz}
            isSubmitting={isSubmittingQuiz}
            onPass={() => setStep('learn')}
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
