import React from 'react';
import { motion } from 'motion/react';
import { Trash2, RotateCcw, Volume2, Loader2, RefreshCw, AlertTriangle, CalendarClock, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { playTTSAudio } from '../utils/audio';
import { reviewStatus } from '../utils/wordStatus';
import { formatUzDate } from '../utils/dateUtils';

/** Serverdagi MAX_STAGE bilan bir xil (server/utils/srs.js) */
const MAX_STAGE = 7;

/**
 * Tarmoq uzilgan paytda qo'shilgan eski so'zlarda ta'rif o'rniga inglizcha
 * xizmat matni yozilgan bo'lishi mumkin ("Definition unavailable (API failed)").
 * Yangi kod bunday yozuvni umuman saqlamaydi, lekin bazada qolganlari bor —
 * ularni tanib, tuzatish tugmasini ko'rsatamiz.
 */
const PLACEHOLDER_DEFINITION = /^(Definition|Example) unavailable/i;

const isIncomplete = (word) =>
  !word.definition || PLACEHOLDER_DEFINITION.test(word.definition);

// forwardRef: Vocabulary'dagi AnimatePresence (popLayout) chiqib ketayotgan
// kartani o'lchashi uchun DOM elementiga yetishi kerak
const WordCard = React.forwardRef(({ word, onDelete, onRelearn, onRefresh, isRelearning = false, isRefreshing = false }, ref) => {
  const stage = word.stage ?? word.reviewStage ?? 0;
  const learned = word.learned ?? word.mastered;
  const incomplete = isIncomplete(word);
  const status = reviewStatus(word);
  const examples = (word.examples || []).filter((ex) => !PLACEHOLDER_DEFINITION.test(ex));
  const hard = (word.lapses || 0) >= 3;

  return (
    <motion.article
      ref={ref}
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="surface group flex h-full flex-col p-5 transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-lg"
    >
      {/* Sarlavha */}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl font-extrabold tracking-tight">{word.word}</h3>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm">
            {word.phonetic && <span className="font-ipa text-muted-foreground">{word.phonetic}</span>}
            {word.partOfSpeech && (
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/80">
                {word.partOfSpeech}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="soft"
          size="icon-sm"
          className="rounded-full"
          onClick={() => playTTSAudio(word.word, 'en-GB', 1.0)}
          aria-label={`"${word.word}" talaffuzini eshitish`}
        >
          <Volume2 />
        </Button>
      </div>

      {word.translation && <p className="mt-2 font-semibold text-primary">{word.translation}</p>}

      {/* Takrorlash holati */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1" title={`Bosqich ${stage} / ${MAX_STAGE}`} aria-label={`Bosqich ${stage} / ${MAX_STAGE}`}>
          {Array.from({ length: MAX_STAGE }).map((_, i) => (
            <span
              key={i}
              className={cn('h-1.5 w-2.5 rounded-full', i < stage ? (learned ? 'bg-success' : 'bg-primary') : 'bg-muted-foreground/15')}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {hard && !learned && <Badge variant="destructive">Qiyin</Badge>}
          <Badge variant={status.tone === 'success' ? 'success' : status.tone === 'warning' ? 'warning' : 'outline'}>
            {status.key === 'learned' ? <CheckCircle2 /> : status.key === 'due' ? <Clock /> : <CalendarClock />}
            {status.label}
          </Badge>
        </div>
      </div>

      {/* Mazmun */}
      <div className="mt-4 flex-1 space-y-3">
        {incomplete ? (
          <div className="space-y-2 rounded-xl border border-warning/30 bg-warning/10 p-3">
            <p className="flex items-start gap-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <span>Qo&apos;shilganda lug&apos;at xizmatiga ulanib bo&apos;lmagan — ta&apos;rif va misol yo&apos;q.</span>
            </p>
            {onRefresh && (
              <Button variant="outline" size="sm" disabled={isRefreshing} onClick={() => onRefresh(word._id)}>
                {isRefreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                Ma&apos;lumotni yuklash
              </Button>
            )}
          </div>
        ) : (
          <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">{word.definition}</p>
        )}

        {examples[0] && (
          <div className="border-l-2 border-primary/30 pl-3 text-sm">
            <p className="italic">{examples[0]}</p>
            {/* O'zbekcha tarjima faqat birinchi (darajaga moslangan) misolda bo'ladi */}
            {word.exampleUz && <p className="mt-0.5 text-muted-foreground">{word.exampleUz}</p>}
          </div>
        )}
      </div>

      {/* Amallar — hover ortiga yashirilmaydi: telefonda hover yo'q */}
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
        {learned && onRelearn ? (
          <Button
            variant="soft"
            size="sm"
            disabled={isRelearning}
            onClick={() => onRelearn(word._id)}
            title="So'z 4-bosqichdan (7 kun) qayta boshlanadi"
          >
            {isRelearning ? <Loader2 className="animate-spin" /> : <RotateCcw />}
            Qayta yodlash
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            {word.createdAt && `Qo'shilgan: ${formatUzDate(word.createdAt)}`}
          </span>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(word)}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label={`"${word.word}" so'zini o'chirish`}
        >
          <Trash2 />
        </Button>
      </div>
    </motion.article>
  );
});
WordCard.displayName = 'WordCard';

export default WordCard;
