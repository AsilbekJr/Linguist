import React, { useState, useRef, useEffect } from 'react';
import { useAskTeacherMutation, useGetMeQuery } from '../features/api/apiSlice';
import { Loader2, SendHorizontal, GraduationCap, BookMarked, MessageCircle, HelpCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Link, useSearchParams } from 'react-router-dom';

const CATEGORIES = [
  { id: 'grammar', label: 'Grammatika', icon: BookMarked },
  { id: 'vocabulary', label: "So'z", icon: GraduationCap },
  { id: 'phrase', label: 'Ibora / Phrasal verb', icon: MessageCircle },
  { id: 'general', label: 'Umumiy', icon: HelpCircle },
];

const SUGGESTIONS = [
  { text: 'Present Perfect qachon ishlatiladi?', category: 'grammar' },
  { text: 'take off iborasi nima degani?', category: 'phrase' },
  { text: 'since va for orasidagi farq', category: 'grammar' },
  { text: 'appreciate so\'zini qanday ishlataman?', category: 'vocabulary' },
];

const formatAnswerForHistory = (answer) => {
  if (!answer) return '';
  const parts = [answer.title, answer.explanation, answer.rule].filter(Boolean);
  return parts.join('\n\n');
};

const AnswerCard = ({ answer }) => {
  if (!answer) return null;
  return (
    <div className="space-y-4 text-sm md:text-base">
      <h4 className="text-lg font-black text-foreground">{answer.title}</h4>
      <p className="text-foreground leading-relaxed whitespace-pre-wrap">{answer.explanation}</p>
      {answer.rule && (
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4">
          <p className="text-xs font-bold uppercase text-primary mb-1">Qoida</p>
          <p className="font-medium">{answer.rule}</p>
        </div>
      )}
      {answer.examples?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-muted-foreground">Misollar</p>
          {answer.examples.map((ex, i) => (
            <div key={i} className="bg-secondary/50 rounded-xl p-3 border border-border">
              <p className="font-medium text-foreground">{ex.en}</p>
              <p className="text-muted-foreground text-sm mt-1">{ex.uz}</p>
            </div>
          ))}
        </div>
      )}
      {answer.commonMistake && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3">
          <p className="text-xs font-bold text-destructive mb-1">Ko'p uchraydigan xato</p>
          <p>{answer.commonMistake}</p>
        </div>
      )}
      {answer.tip && (
        <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-3">
          <p className="text-xs font-bold text-green-600 dark:text-green-400 mb-1">Eslab qoling</p>
          <p>{answer.tip}</p>
        </div>
      )}
    </div>
  );
};

const TutorAI = () => {
  const { data: user } = useGetMeQuery();
  const [askTeacher, { isLoading }] = useAskTeacherMutation();
  const [searchParams] = useSearchParams();
  const prefilledQ = searchParams.get('q') || '';

  const [category, setCategory] = useState('general');
  const [input, setInput] = useState(prefilledQ);
  const [messages, setMessages] = useState([]);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const submitQuestion = async (questionText, cat = category) => {
    const q = questionText.trim();
    if (!q || isLoading) return;

    const userMsg = { role: 'user', content: q, category: cat };
    const historyForApi = messages.map((m) => ({
      role: m.role,
      content: m.role === 'ai' ? formatAnswerForHistory(m.answer) || m.content : m.content,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    try {
      const data = await askTeacher({
        question: q,
        category: cat,
        chatHistory: historyForApi,
      }).unwrap();

      setMessages((prev) => [...prev, { role: 'ai', answer: data.answer }]);
    } catch (err) {
      const msg =
        err?.status === 402 || err?.data?.type === 'QUOTA_EXCEEDED'
          ? "Kunlik AI limiti tugadi. Tariflar sahifasiga o'ting."
          : err?.data?.error || "Javob olib bo'lmadi. Qayta urinib ko'ring.";
      toast.error(msg);
      setMessages((prev) => [...prev, { role: 'ai', content: msg, isError: true }]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submitQuestion(input);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pb-8 animate-fade-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-500 mb-4">
          <GraduationCap className="w-8 h-8" />
        </div>
        <h1 className="text-3xl md:text-4xl font-black bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
          Ustoz AI
        </h1>
        <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
          Grammatika, so'z yoki ibora tushunarsiz bo'lsa — savol bering, AI o'qituvchi sifatida o'zbekcha tushuntiradi.
        </p>
        {user?.onboarding?.level && (
          <p className="text-xs text-muted-foreground mt-2">
            Sizning darajangiz: <span className="font-bold">{user.onboarding.level}</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6 justify-center">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
                category === c.id
                  ? 'bg-indigo-500 text-white border-indigo-500'
                  : 'bg-card border-border text-muted-foreground hover:border-indigo-500/50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {c.label}
            </button>
          );
        })}
      </div>

      {messages.length === 0 && (
        <div className="mb-6">
          <p className="text-xs font-bold uppercase text-muted-foreground mb-3 text-center">Tez savollar</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.text}
                type="button"
                onClick={() => {
                  setCategory(s.category);
                  submitQuestion(s.text, s.category);
                }}
                className="text-sm px-4 py-2 rounded-full bg-secondary border border-border hover:border-indigo-500/50 transition-colors"
              >
                {s.text}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm flex flex-col min-h-[420px]">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-h-[55vh]">
          {messages.length === 0 && (
            <p className="text-center text-muted-foreground text-sm py-12">
              Savolingizni yozing — masalan: &quot;Would vs Could farqi nima?&quot;
            </p>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-2xl p-4 ${
                  msg.role === 'user'
                    ? 'bg-indigo-500 text-white rounded-br-none'
                    : msg.isError
                      ? 'bg-destructive/10 border border-destructive/30 text-destructive rounded-bl-none'
                      : 'bg-muted/50 border border-border rounded-bl-none'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : msg.answer ? (
                  <AnswerCard answer={msg.answer} />
                ) : (
                  <p>{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Ustoz o'ylamoqda...
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t border-border flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Savolingizni yozing (o'zbek yoki ingliz tilida)..."
            rows={2}
            className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-sm resize-none outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="shrink-0 p-4 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 disabled:opacity-50"
          >
            <SendHorizontal className="w-5 h-5" />
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-muted-foreground mt-4">
        AI kunlik limitiga kiradi.{' '}
        <Link to="/pricing" className="text-indigo-500 font-bold hover:underline">
          Tariflar
        </Link>
      </p>
    </div>
  );
};

export default TutorAI;
