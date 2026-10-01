import React from 'react';
import { motion } from 'motion/react';
import { Mic, Sparkles, Trash2, CalendarClock, ShieldCheck } from 'lucide-react';
import { useGetMeQuery } from '../features/api/apiSlice';
import { PageHeader, PageSkeleton } from '@/components/ui/primitives';
import { Button } from '@/components/ui/button';
import { deleteEntry, notifyDiaryChanged } from '../lib/voiceDiary';
import {
  STORY_PROMPT, STORY_MAX_SECONDS, isStoryDue, daysUntilNextStory, pickComparison, dayLabel, storiesOf,
} from '../utils/diaryLogic';
import { EntryAudio, RecordCard } from '../components/VoiceDiary/DiaryParts';
import { useDiaryEntries } from '../hooks/useDiaryEntries';

const formatDay = (key) => {
  const [y, m, d] = String(key).split('-');
  return `${d}.${m}.${y}`;
};

/**
 * Ovoz kundaligi — o'sishni o'z qulog'ingiz bilan eshitish.
 *
 * Raqamlar ("120 so'z", "15 kunlik streak") mavhum. 1-kundagi va bugungi
 * hikoyangizni yonma-yon eshitish esa farqni darhol his qildiradi: talaffuz,
 * tezlik, gaplar uzunligi. Savollar har safar bir xil — solishtirish halol.
 */
const VoiceDiary = () => {
  const { data: user } = useGetMeQuery();
  const { entries, loading } = useDiaryEntries();
  const todayKey = user?.today;

  if (loading || !todayKey) return <PageSkeleton cards={2} />;

  const due = isStoryDue(entries, todayKey);
  const waitDays = daysUntilNextStory(entries, todayKey);
  const comparison = pickComparison(entries);
  const stories = storiesOf(entries).reverse();
  const phrases = entries.filter((e) => e.kind === 'phrase').sort((a, b) => b.createdAt - a.createdAt);

  const remove = async (id) => {
    await deleteEntry(id);
    notifyDiaryChanged();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow="Ko'proq"
        title="Ovoz kundaligi"
        description="Har 7 kunda o'zingiz haqingizda 30 soniya. Bir oydan keyin 1-kundagi ovozingizni eshitib, farqni o'zingiz sezasiz."
        icon={Mic}
      />

      <p className="flex items-start gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
        Yozuvlar faqat shu qurilmada saqlanadi va hech qayerga yuborilmaydi. Brauzer ma&apos;lumoti tozalansa yo&apos;qoladi —
        muhimlarini yuklab oling.
      </p>

      {/* ── 1-kun va bugun ──────────────────────────────────────────────── */}
      {comparison && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="hero-mesh noise relative overflow-hidden rounded-[1.75rem] p-5 text-white sm:p-7"
        >
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/80">
            <Sparkles className="size-3.5" /> {comparison.days} kunlik o&apos;sish
          </p>
          <h2 className="mt-1 text-2xl font-extrabold">1-kun va bugun</h2>
          <p className="mt-1 text-sm text-white/80">Avval birinchisini, keyin oxirgisini eshiting.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[comparison.first, comparison.last].map((e, i) => (
              <div key={e.id} className="rounded-2xl bg-white/95 p-3 text-foreground">
                <p className="mb-2 text-xs font-bold text-primary">
                  {i === 0 ? 'Boshlanishi' : 'Hozir'} · {dayLabel(entries, e.dayKey)} ({formatDay(e.dayKey)})
                </p>
                <EntryAudio entry={e} />
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* ── Hikoya yozish ───────────────────────────────────────────────── */}
      {due ? (
        <RecordCard
          kind="story"
          dayKey={todayKey}
          maxSeconds={STORY_MAX_SECONDS}
          title={stories.length ? 'Yangi hikoya vaqti keldi' : 'Birinchi hikoyangiz'}
          text={STORY_PROMPT.questions.join(' ')}
        >
          <p className="text-sm text-muted-foreground">{STORY_PROMPT.uz}</p>
          <ul className="space-y-1 rounded-2xl bg-primary/5 p-4 text-[15px] font-semibold">
            {STORY_PROMPT.questions.map((q) => (
              <li key={q}>• {q}</li>
            ))}
          </ul>
        </RecordCard>
      ) : (
        <div className="surface flex items-center gap-3 p-4 text-sm">
          <CalendarClock className="size-5 shrink-0 text-primary" />
          <span>
            Keyingi hikoya <strong>{waitDays} kundan keyin</strong>. Shu orada har suhbatdan keyin bugungi gapingizni yozib boring.
          </span>
        </div>
      )}

      {/* ── Hikoyalar ───────────────────────────────────────────────────── */}
      {stories.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">Hikoyalar</h2>
          {stories.map((e) => (
            <div key={e.id} className="surface p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-bold">
                  {dayLabel(entries, e.dayKey)} <span className="font-normal text-muted-foreground">· {formatDay(e.dayKey)}</span>
                </p>
                <Button variant="ghost" size="icon-sm" onClick={() => remove(e.id)} aria-label="O'chirish">
                  <Trash2 />
                </Button>
              </div>
              <EntryAudio entry={e} />
            </div>
          ))}
        </section>
      )}

      {/* ── Kunlik iboralar ─────────────────────────────────────────────── */}
      {phrases.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">Suhbatlardan</h2>
          {phrases.map((e) => (
            <div key={e.id} className="surface p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-muted-foreground">
                    {dayLabel(entries, e.dayKey)} · {formatDay(e.dayKey)}
                  </p>
                  {e.text && <p className="font-semibold">{e.text}</p>}
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => remove(e.id)} aria-label="O'chirish">
                  <Trash2 />
                </Button>
              </div>
              <EntryAudio entry={e} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

export default VoiceDiary;
