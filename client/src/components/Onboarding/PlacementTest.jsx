import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Loader2, Gauge, ArrowRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  useStartPlacementMutation,
  useAnswerPlacementMutation,
} from '../../features/api/apiSlice';
import { setCredentials } from '../../features/auth/authSlice';
import { Button } from '@/components/ui/button';
import { fireConfetti } from '../../utils/celebration';
import { track } from '../../lib/analytics';

const CEFR_LABEL = {
  A1: { title: 'A1 — Boshlang\'ich', desc: 'Eng kerakli kundalik so\'zlardan boshlaymiz.' },
  A2: { title: 'A2 — Elementar', desc: 'Kundalik vaziyatlarni boshqarishni o\'rganamiz.' },
  B1: { title: 'B1 — O\'rta', desc: 'Fikr bildirish va murakkabroq suhbatlarga o\'tamiz.' },
  B2: { title: 'B2 — O\'rtadan yuqori', desc: 'Nozik ma\'nolar va professional muloqot.' },
};

/**
 * Daraja aniqlash testi.
 *
 * Ilgari foydalanuvchi darajasini o'zi tanlardi — o'z-o'zini baholash til
 * o'rganishda eng ishonchsiz signal. Bundan tashqari tanlangan daraja
 * kontentga umuman ta'sir qilmasdi: hamma 1-kundan boshlardi.
 *
 * Savollar va to'g'ri javoblar serverda — natijani ko'tarib olish mumkin emas.
 */
const PlacementTest = ({ onDone, onSkip }) => {
  const dispatch = useDispatch();
  const token = useSelector((s) => s.auth.token);

  const [sessionId, setSessionId] = useState(null);
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [answeredCount, setAnsweredCount] = useState(0);

  const [startPlacement, { isLoading: isStarting }] = useStartPlacementMutation();
  const [answerPlacement, { isLoading: isAnswering }] = useAnswerPlacementMutation();

  const handleStart = async () => {
    try {
      const res = await startPlacement().unwrap();
      setSessionId(res.sessionId);
      setQuestion(res.question);
      setAnsweredCount(0);
      track('placement_started');
    } catch {
      toast.error("Testni boshlashda xatolik. Qayta urinib ko'ring.");
    }
  };

  const handleAnswer = async (optionIndex) => {
    if (selected !== null || isAnswering) return;
    setSelected(optionIndex);

    try {
      const res = await answerPlacement({
        sessionId,
        itemId: question.itemId,
        answered: optionIndex,
      }).unwrap();

      setAnsweredCount((n) => n + 1);

      setTimeout(() => {
        setSelected(null);
        if (res.done) {
          setResult(res);
          setQuestion(null);
          fireConfetti();
          track('placement_completed', {
            cefr: res.resultCefr,
            correct: res.correctCount,
            total: res.totalQuestions,
          });
          if (res.user && token) {
            dispatch(setCredentials({ user: res.user, token }));
          }
        } else {
          setQuestion(res.question);
        }
      }, 350);
    } catch (err) {
      setSelected(null);
      toast.error(err?.data?.error || 'Javobni yuborishda xatolik');
    }
  };

  // ── Natija ────────────────────────────────────────────────────────────
  if (result) {
    const label = CEFR_LABEL[result.resultCefr] || CEFR_LABEL.A1;
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">🎯</div>
        <p className="text-xs font-bold uppercase text-primary mb-1">Sizning darajangiz</p>
        <h2 className="text-3xl font-black mb-2">{label.title}</h2>
        <p className="text-muted-foreground mb-6">{label.desc}</p>

        <div className="bg-secondary/60 rounded-2xl p-4 mb-6 text-sm">
          <p className="font-bold mb-1">
            {result.correctCount} / {result.totalQuestions} to&apos;g&apos;ri
          </p>
          {result.startTopic && (
            <p className="text-muted-foreground">
              Kurs <span className="font-bold text-foreground">{result.startDay}-kundan</span> boshlanadi:
              {' '}&quot;{result.startTopic.topicUz}&quot;
            </p>
          )}
        </div>

        <Button size="lg" className="rounded-full font-bold w-full" onClick={() => onDone?.(result)}>
          Boshlash <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  // ── Savol ─────────────────────────────────────────────────────────────
  if (question) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold uppercase text-primary">Daraja aniqlash</p>
          <span className="text-xs text-muted-foreground">{answeredCount + 1}-savol</span>
        </div>

        <div className="h-1.5 bg-secondary rounded-full mb-6 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${Math.min(100, (answeredCount / 12) * 100)}%` }}
          />
        </div>

        <p className="text-lg sm:text-xl font-bold mb-6 leading-relaxed">{question.prompt}</p>

        <div className="space-y-3">
          {question.options.map((opt, i) => (
            <button
              key={opt}
              type="button"
              disabled={selected !== null || isAnswering}
              onClick={() => handleAnswer(i)}
              className={`w-full text-left p-4 rounded-xl border font-medium transition-colors ${
                selected === i
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              } disabled:opacity-60`}
            >
              {opt}
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Bilmasangiz taxmin qilmang — noto&apos;g&apos;ri daraja o&apos;rganishni sekinlashtiradi.
        </p>
      </div>
    );
  }

  // ── Boshlash ──────────────────────────────────────────────────────────
  return (
    <div className="text-center">
      <Gauge className="w-12 h-12 text-primary mx-auto mb-4" />
      <h2 className="text-2xl sm:text-3xl font-black mb-3">Darajangizni aniqlaymiz</h2>
      <p className="text-muted-foreground mb-2">
        2 daqiqalik qisqa test. Savollar javobingizga qarab moslashadi.
      </p>
      <p className="text-sm text-muted-foreground mb-8">
        Natijaga qarab kurs sizga mos kundan boshlanadi — bu vaqtingizni tejaydi.
      </p>

      <Button
        size="lg"
        className="rounded-full font-bold w-full mb-3"
        onClick={handleStart}
        disabled={isStarting}
      >
        {isStarting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Testni boshlash'}
      </Button>

      {onSkip && (
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Keyinroq, darajani o&apos;zim tanlayman
        </button>
      )}
    </div>
  );
};

export default PlacementTest;
