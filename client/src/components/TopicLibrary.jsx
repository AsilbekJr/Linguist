import React, { useState } from 'react';
import { motion } from 'motion/react';
import { toast } from 'react-hot-toast';
import { Check, CheckCircle2, Library, Loader2, Plus, Volume2 } from 'lucide-react';
import {
  useGetVocabTopicsQuery,
  useGetVocabTopicQuery,
  useAddVocabTopicWordsMutation,
  useGetMeQuery,
} from '../features/api/apiSlice';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from './ui/dialog';
import { Button } from './ui/button';
import { EmptyState, ProgressBar, Segmented, Skeleton } from './ui/primitives';
import { cn } from '@/lib/utils';
import { playTTSAudio } from '../utils/audio';

const EASE = [0.16, 1, 0.3, 1];

/** Bitta mavzuning so'zlari — qo'shish shu yerda */
const TopicWords = ({ topicId }) => {
  const { data: topic, isLoading, isError } = useGetVocabTopicQuery(topicId);
  const [addWords] = useAddVocabTopicWordsMutation();
  // Qaysi so'z qo'shilmoqda; '*' — hammasi
  const [busy, setBusy] = useState(null);

  if (isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (isError || !topic) {
    return <p className="text-sm text-destructive">Mavzuni yuklab bo&apos;lmadi. Qayta urinib ko&apos;ring.</p>;
  }

  const unsaved = topic.words.filter((w) => !w.saved).length;

  const add = async (word) => {
    setBusy(word || '*');
    try {
      const res = await addWords({ id: topicId, words: word ? [word] : undefined }).unwrap();
      if (word) toast.success(`"${word}" lug'atga qo'shildi`);
      else toast.success(`${res.added} ta so'z lug'atga qo'shildi — bugun takrorlashda chiqadi`);
    } catch {
      toast.error("Qo'shib bo'lmadi. Qayta urinib ko'ring.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/60 p-3">
        <p className="text-sm">
          <span className="font-bold tabular">{topic.words.length - unsaved}</span>
          <span className="text-muted-foreground">/{topic.words.length} ta so&apos;z lug&apos;atingizda</span>
        </p>
        {unsaved > 0 ? (
          <Button size="sm" onClick={() => add()} disabled={Boolean(busy)}>
            {busy === '*' ? <Loader2 className="animate-spin" /> : <Plus />}
            Hammasini qo&apos;shish ({unsaved})
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm font-bold text-success">
            <CheckCircle2 className="size-4" /> Hammasi qo&apos;shilgan
          </span>
        )}
      </div>

      <ul className="space-y-2">
        {topic.words.map((w, i) => (
          <motion.li
            key={w.word}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 12) * 0.025, duration: 0.3, ease: EASE }}
            className={cn('rounded-2xl border p-3 sm:p-4', w.saved ? 'border-success/25 bg-success/5' : 'border-border bg-card')}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-lg font-extrabold tracking-tight">{w.word}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{w.partOfSpeech}</span>
                </div>
                <p className="font-semibold text-primary">{w.translation}</p>
                <p className="mt-1.5 text-sm italic">{w.example}</p>
                <p className="text-sm text-muted-foreground">{w.exampleUz}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-1.5">
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="rounded-full"
                  onClick={() => playTTSAudio(w.word, 'en-GB', 0.95)}
                  aria-label={`"${w.word}" talaffuzini eshitish`}
                >
                  <Volume2 />
                </Button>
                <Button
                  variant={w.saved ? 'success' : 'soft'}
                  size="icon-sm"
                  className="rounded-full"
                  disabled={w.saved || Boolean(busy)}
                  onClick={() => add(w.word)}
                  aria-label={w.saved ? "Lug'atda bor" : `"${w.word}" so'zini lug'atga qo'shish`}
                >
                  {busy === w.word ? <Loader2 className="animate-spin" /> : w.saved ? <Check strokeWidth={3} /> : <Plus />}
                </Button>
              </div>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
};

const TopicCard = ({ topic, index, onOpen }) => {
  const done = topic.savedCount >= topic.wordCount;
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.03, duration: 0.35, ease: EASE }}
      whileHover={{ y: -2 }}
      className="surface group flex h-full flex-col p-4 text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl" aria-hidden="true">
          {topic.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Unit {topic.unit} · {topic.title}
          </p>
          <h3 className="mt-0.5 font-extrabold leading-snug">{topic.titleUz}</h3>
        </div>
        {done && <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Hammasi qo'shilgan" />}
      </div>
      <p className="mt-3 line-clamp-1 text-sm text-muted-foreground">{topic.preview.join(' · ')} …</p>
      <div className="mt-auto flex items-center gap-3 pt-4">
        <ProgressBar
          value={topic.savedCount}
          max={topic.wordCount}
          tone={done ? 'success' : 'primary'}
          className="h-1.5 flex-1"
          label={`${topic.titleUz}: lug'atdagi so'zlar`}
        />
        <span className="text-xs font-bold tabular text-muted-foreground">
          {topic.savedCount}/{topic.wordCount}
        </span>
      </div>
    </motion.button>
  );
};

/**
 * Mavzular kutubxonasi: daraja → mavzu → so'zlar.
 * Mavzular "English Vocabulary in Use" unit'lari asosida; tarjima va
 * misollar Linguist uchun yozilgan.
 */
/** Onboarding darajasiga mos kitob */
const LEVEL_BY_ONBOARDING = { beginner: 'elementary', intermediate: 'upper-intermediate', advanced: 'advanced' };
const levelForUser = (user) => LEVEL_BY_ONBOARDING[user?.onboarding?.level] || 'elementary';

const TopicLibrary = () => {
  const { data, isLoading, isError, refetch } = useGetVocabTopicsQuery();
  const { data: user } = useGetMeQuery();
  const [openId, setOpenId] = useState(null);
  // Tanlanmaguncha — foydalanuvchi darajasiga mos daraja
  const [levelKey, setLevelKey] = useState(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (isError || !data) {
    return (
      <EmptyState icon={Library} tone="warning" title="Mavzularni yuklab bo'lmadi" description="Internet aloqasini tekshirib, qayta urinib ko'ring.">
        <Button onClick={refetch}>Qayta urinish</Button>
      </EmptyState>
    );
  }

  const open = data.levels.flatMap((l) => l.topics).find((t) => t.id === openId);
  const preferred = levelKey || levelForUser(user);
  const level = data.levels.find((l) => l.key === preferred) || data.levels[0];
  const levelTotal = level.topics.reduce((sum, t) => sum + t.wordCount, 0);
  const levelSaved = level.topics.reduce((sum, t) => sum + t.savedCount, 0);

  return (
    <div className="space-y-6">
      {data.levels.length > 1 && (
        <Segmented
          ariaLabel="Daraja"
          layoutId="topic-level"
          value={level.key}
          onChange={setLevelKey}
          options={data.levels.map((l) => ({ value: l.key, label: l.titleUz }))}
        />
      )}
      <section aria-labelledby={`level-${level.key}`}>
        <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 id={`level-${level.key}`} className="text-xl font-extrabold">
            {level.title} · {level.cefrRange}
          </h2>
          <span className="text-sm text-muted-foreground">
            {level.topics.length} ta mavzu · {levelSaved}/{levelTotal} ta so&apos;z lug&apos;atingizda
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {level.topics.map((t, i) => (
            <TopicCard key={t.id} topic={t} index={i} onOpen={() => setOpenId(t.id)} />
          ))}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Mavzular «English Vocabulary in Use» (Cambridge) kitoblari tuzilishiga tayanadi. Tarjima va misollar Linguist uchun yozilgan.
      </p>

      <Dialog open={Boolean(openId)} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span aria-hidden="true">{open.emoji}</span> {open.titleUz}
                </DialogTitle>
                <DialogDescription>
                  Unit {open.unit} · {open.title}. Qo&apos;shilgan so&apos;zlar bugunoq takrorlashda chiqadi.
                </DialogDescription>
              </DialogHeader>
              <TopicWords topicId={open.id} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TopicLibrary;
