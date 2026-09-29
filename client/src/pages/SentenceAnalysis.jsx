import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ScanText, Loader2, Send, Shuffle, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, Skeleton } from '@/components/ui/primitives';
import { useAnalyzeSentenceMutation, useGetWordsQuery } from '../features/api/apiSlice';
import SentenceBreakdown from '../components/SentenceBreakdown';

const EXAMPLES = [
  'She is reading a book in the garden.',
  'We will visit our grandparents next weekend.',
  'The children played football after school.',
];

/**
 * Gap tahlili sahifasi — "Ustoz AI" ning o'rniga.
 *
 * Eski Ustoz AI erkin chat edi: foydalanuvchi nima so'rashini bilmasdi va
 * javob uning lug'atiga hech qanday tarzda bog'lanmagan edi. Bu yerda kirish
 * aniq — bitta gap, va lug'atdagi so'zlardan tayyor misollar taklif qilinadi.
 */
const SentenceAnalysis = () => {
  const [sentence, setSentence] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);

  const { data: words = [] } = useGetWordsQuery();
  const [analyzeSentence, { isLoading }] = useAnalyzeSentenceMutation();

  /** Lug'atdagi so'zlarning misol gaplari — tayyor boshlang'ich nuqta */
  const suggestions = useMemo(
    () =>
      words
        .filter((w) => w.examples?.[0])
        .slice(0, 40)
        .map((w) => ({ word: w.word, sentence: w.examples[0] })),
    [words]
  );

  const run = async (text) => {
    const value = String(text || '').trim();
    if (!value || isLoading) return;

    setError(null);
    setAnalysis(null);
    setSentence(value);

    try {
      setAnalysis(await analyzeSentence(value).unwrap());
    } catch (err) {
      setError(err?.data?.message || "Tahlil hozir ishlamayapti. Keyinroq urinib ko'ring.");
    }
  };

  const pickRandom = () => {
    if (!suggestions.length) return;
    run(suggestions[Math.floor(Math.random() * suggestions.length)].sentence);
  };

  const starters = suggestions.length
    ? suggestions.slice(0, 6)
    : EXAMPLES.map((s) => ({ word: 'Misol', sentence: s }));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Gap tahlili"
        title="Gapni bo'laklarga ajrating"
        tone="info"
        icon={ScanText}
        description="Inglizcha gap kiriting — har bir so'zning turkumi (ot, fe'l, sifat…) va gapdagi vazifasi (ega, kesim, to'ldiruvchi…) tushuntiriladi."
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(sentence);
        }}
        className="space-y-3"
      >
        <div className="flex items-center gap-1.5 rounded-2xl border border-input bg-card p-1.5 shadow-xs transition-[border-color,box-shadow] focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
          <input
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            placeholder="She is reading a book in the garden."
            className="h-11 min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-muted-foreground/70"
            disabled={isLoading}
            maxLength={400}
            aria-label="Tahlil qilinadigan inglizcha gap"
            autoCapitalize="sentences"
            spellCheck={false}
          />
          <Button type="submit" className="shrink-0 rounded-xl" disabled={isLoading || !sentence.trim()}>
            {isLoading ? <Loader2 className="animate-spin" /> : <Send />}
            <span className="hidden sm:inline">Tahlil qilish</span>
          </Button>
        </div>

        {suggestions.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={pickRandom} disabled={isLoading}>
            <Shuffle /> Lug&apos;atimdagi so&apos;zdan tasodifiy misol
          </Button>
        )}
      </form>

      <div className="mt-6">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="surface space-y-3 p-5">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2 pt-2">
                {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-7 w-20 rounded-full" />)}
              </div>
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="alert"
              className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/8 p-4"
            >
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <p className="text-sm font-medium text-destructive">{error}</p>
            </motion.div>
          ) : analysis ? (
            <motion.div
              key={analysis.sentence}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="surface p-5 sm:p-6"
            >
              <SentenceBreakdown analysis={analysis} />
            </motion.div>
          ) : (
            <motion.div key="starters" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <p className="mb-3 text-sm font-bold">
                {suggestions.length ? "Lug'atingizdagi so'zlar ishtirokidagi gaplar" : 'Boshlash uchun misollar'}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {starters.map((s, i) => (
                  <motion.button
                    key={`${s.word}-${i}`}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * i }}
                    onClick={() => run(s.sentence)}
                    className="surface-interactive group flex items-start gap-3 p-4 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-primary">{s.word}</span>
                      <span className="mt-1 block text-sm">{s.sentence}</span>
                    </span>
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SentenceAnalysis;
