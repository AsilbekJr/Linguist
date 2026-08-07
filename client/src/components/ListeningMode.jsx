import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  useGetListeningSessionQuery,
  useCheckDictationMutation,
  useCompleteListeningMutation,
} from '../features/api/apiSlice';
import { Headphones, Volume2, Rabbit, Turtle, Loader2, CheckCircle2, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { playTTSAudio } from '../utils/audio';
import { fireConfetti } from '../utils/celebration';

/**
 * Tinglab yozish (diktant).
 *
 * Bu ilovadagi yagona INPUT mashqi. Ilgari faqat output bor edi — yozish va
 * gapirish. Til o'rganishning katta qismi tushunarli input orqali kechadi,
 * shuning uchun bu eng katta bo'shliq edi.
 *
 * Ovoz brauzerning speechSynthesis'i bilan chiqariladi: tashqi TTS xizmatiga
 * pul to'lashsiz ishlaydi va oflayn ham chiqadi. Kamchiligi — ovoz sifati
 * qurilmaga bog'liq; matn ham mijozda bo'ladi, lekin bu mashq hech narsani
 * ochmaydi, shuning uchun "aldash" faqat aldayotgan odamga zarar.
 */
const ListeningMode = () => {
  const { data: session, isLoading } = useGetListeningSessionQuery();
  const [checkDictation, { isLoading: isChecking }] = useCheckDictationMutation();
  const [completeListening] = useCompleteListeningMutation();

  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [scores, setScores] = useState([]);
  const [finished, setFinished] = useState(false);
  const inputRef = useRef(null);

  const lines = session?.lines || [];
  const line = lines[index];

  const speak = (rate) => {
    if (!line) return;
    playTTSAudio(line.en, 'en-GB', rate);
  };

  const handleCheck = async () => {
    if (!typed.trim() || !line) return;
    try {
      const res = await checkDictation({ lineIndex: line.index, typed }).unwrap();
      setResult(res);
      setScores((prev) => [...prev, res.score]);
    } catch {
      toast.error("Tekshirishda xatolik. Qayta urinib ko'ring.");
    }
  };

  const handleNext = async () => {
    setResult(null);
    setTyped('');
    setRevealed(false);

    if (index < lines.length - 1) {
      setIndex((i) => i + 1);
      setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    try {
      const res = await completeListening().unwrap();
      if (res.xpAwarded) {
        fireConfetti();
        toast.success(res.message);
      }
    } catch {
      // XP berilmasa ham mashq bajarildi
    }
    setFinished(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!lines.length) {
    return (
      <div className="text-center py-20 bg-card border border-dashed border-border rounded-3xl max-w-2xl mx-auto px-6">
        <div className="text-5xl mb-4">🎧</div>
        <h2 className="text-2xl font-bold mb-4">Tinglash mashqi tayyor emas</h2>
        <p className="text-muted-foreground mb-6">
          Avval kunlik sahnani oching — mashq o&apos;sha kunning dialogidan tuziladi.
        </p>
        <Link to="/topic" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-full">
          Kunlik sahnaga →
        </Link>
      </div>
    );
  }

  if (finished) {
    const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    return (
      <div className="max-w-lg mx-auto text-center py-16 bg-card border border-border rounded-3xl px-6">
        <div className="text-5xl mb-4">🎧</div>
        <h2 className="text-2xl font-black mb-2">Tinglash mashqi tugadi</h2>
        <p className="text-muted-foreground mb-8">
          O&apos;rtacha aniqlik: <span className="font-bold text-foreground">{avg}%</span>
        </p>
        <div className="flex flex-col gap-3">
          <Link to="/topic" className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-full">
            Kunlik sahnaga qaytish
          </Link>
          <Link to="/" className="text-primary font-bold text-sm">
            Bosh sahifa →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="text-center mb-6">
        <p className="text-xs font-bold uppercase text-teal-600 flex items-center justify-center gap-2">
          <Headphones className="w-4 h-4" /> Tinglab yozish
        </p>
        <h1 className="text-2xl sm:text-3xl font-black mt-1">{session.topicUz}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {index + 1} / {lines.length} · Eshitganingizni yozing
        </p>
      </div>

      <div className="h-2 bg-secondary rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-teal-500 transition-all"
          style={{ width: `${(index / lines.length) * 100}%` }}
        />
      </div>

      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
        <div className="flex justify-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => speak(0.95)}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold hover:bg-teal-500/20 transition-colors"
          >
            <Volume2 className="w-5 h-5" /> Tinglash
          </button>
          <button
            type="button"
            onClick={() => speak(0.6)}
            className="flex items-center gap-2 px-4 py-3 rounded-full border border-border font-bold text-sm hover:bg-secondary transition-colors"
            title="Sekinroq"
          >
            <Turtle className="w-5 h-5" /> Sekin
          </button>
          <button
            type="button"
            onClick={() => speak(1.15)}
            className="flex items-center gap-2 px-4 py-3 rounded-full border border-border font-bold text-sm hover:bg-secondary transition-colors"
            title="Tezroq"
          >
            <Rabbit className="w-5 h-5" /> Tez
          </button>
        </div>

        {!result ? (
          <>
            <textarea
              ref={inputRef}
              rows={3}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleCheck();
                }
              }}
              placeholder="Eshitganingizni shu yerga yozing..."
              className="w-full bg-background border border-border rounded-xl p-4 text-lg outline-none resize-none focus:border-teal-500 transition-colors"
            />

            <div className="flex items-center justify-between mt-3 gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Eye className="w-4 h-4" /> {revealed ? 'Yashirish' : "Matnni ko'rsatish"}
              </button>
              <span className="text-xs text-muted-foreground">{line.speaker}</span>
            </div>

            {revealed && (
              <p className="mt-3 p-3 rounded-xl bg-secondary/60 text-sm">{line.en}</p>
            )}

            <button
              type="button"
              onClick={handleCheck}
              disabled={isChecking || !typed.trim()}
              className="w-full mt-5 py-4 bg-teal-600 text-white rounded-xl font-bold disabled:opacity-50 hover:bg-teal-500 transition-colors"
            >
              {isChecking ? 'Tekshirilmoqda...' : 'Tekshirish'}
            </button>
          </>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-2xl font-black">{result.score}%</span>
              {result.isPerfect && <CheckCircle2 className="w-7 h-7 text-green-500" />}
            </div>

            {/* So'z darajasidagi farq — foydalanuvchi aynan qayerda adashganini ko'radi */}
            <div className="flex flex-wrap gap-1.5 mb-4 p-4 rounded-xl bg-background border border-border">
              {result.tokens.map((t, i) => (
                <span
                  key={`${t.word}-${i}`}
                  className={
                    t.status === 'correct'
                      ? 'px-2 py-1 rounded-md bg-green-500/15 text-green-700 dark:text-green-400 text-sm'
                      : t.status === 'missing'
                        ? 'px-2 py-1 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400 text-sm font-bold'
                        : 'px-2 py-1 rounded-md bg-destructive/10 text-destructive text-sm line-through'
                  }
                  title={
                    t.status === 'missing'
                      ? "Bu so'z yozilmagan"
                      : t.status === 'extra'
                        ? "Ortiqcha so'z"
                        : "To'g'ri"
                  }
                >
                  {t.word}
                </span>
              ))}
            </div>

            <p className="text-sm mb-4">{result.feedback}</p>

            <div className="p-4 rounded-xl bg-secondary/60 mb-5">
              <p className="text-xs uppercase text-muted-foreground mb-1">Asl matn</p>
              <p className="font-medium">{result.expected}</p>
              <p className="text-sm text-muted-foreground mt-1">{result.uz}</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => speak(0.6)}
                className="px-4 py-3 rounded-xl border border-border font-bold text-sm"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 py-3 bg-teal-600 text-white rounded-xl font-bold hover:bg-teal-500 transition-colors"
              >
                {index < lines.length - 1 ? 'Keyingi →' : 'Yakunlash'}
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6">
        Ovoz brauzeringiz yordamida chiqariladi — sifati qurilmaga bog&apos;liq.
      </p>
    </div>
  );
};

export default ListeningMode;
