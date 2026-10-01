import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { BookOpen, Search, Plus, X, Clock, Flame, CheckCircle2, Layers, SearchX } from 'lucide-react';
import {
  useGetWordsQuery,
  useAddWordMutation,
  useDeleteWordMutation,
  useRelearnWordMutation,
  useMarkWordKnownMutation,
  useRefreshWordMutation,
} from '../features/api/apiSlice';
import WordForm from '../components/WordForm';
import WordCard from '../components/WordCard';
import ConfirmDialog from '../components/ui/confirm-dialog';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogHeader } from '../components/ui/dialog';
import { Button } from '../components/ui/button';
import { EmptyState, PageHeader, Segmented, Skeleton } from '../components/ui/primitives';
import { isDue, isLearned } from '../utils/wordStatus';

const PAGE_SIZE = 24;

const FILTERS = [
  { value: 'all', label: 'Hammasi', icon: Layers },
  { value: 'due', label: 'Bugun', icon: Clock },
  { value: 'learning', label: 'Yodlanmoqda', icon: BookOpen },
  { value: 'hard', label: 'Qiyin', icon: Flame },
  { value: 'learned', label: 'Yodlangan', icon: CheckCircle2 },
];

const matchesFilter = (word, filter) => {
  switch (filter) {
    case 'due':
      return isDue(word);
    case 'learning':
      return !isLearned(word);
    case 'hard':
      return !isLearned(word) && (word.lapses || 0) >= 3;
    case 'learned':
      return isLearned(word);
    default:
      return true;
  }
};

const EMPTY_COPY = {
  due: { title: "Bugun takrorlanadigan so'z yo'q", description: "Hamma so'z o'z jadvalida. Ertaga yana tekshiring." },
  learning: { title: "Yodlanayotgan so'z qolmadi", description: "Hammasi yodlangan! Yangi so'z qo'shing yoki kunlik sahnadan oling." },
  hard: { title: "Qiyin so'zlar yo'q", description: "3 martadan ko'p unutilgan so'zlar shu yerda to'planadi." },
  learned: { title: "Hali yodlangan so'z yo'q", description: "So'z 7 marta muvaffaqiyatli takrorlangach shu yerga o'tadi." },
};

const Vocabulary = () => {
  const { data: words = [], isLoading } = useGetWordsQuery();
  const [addWordMutation] = useAddWordMutation();
  const [deleteWordMutation, { isLoading: isDeleting }] = useDeleteWordMutation();
  const [relearnWordMutation] = useRelearnWordMutation();
  const [markWordKnownMutation] = useMarkWordKnownMutation();
  const [refreshWordMutation] = useRefreshWordMutation();

  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [relearningId, setRelearningId] = useState(null);
  const [markingKnownId, setMarkingKnownId] = useState(null);
  const [refreshingId, setRefreshingId] = useState(null);

  const handleAddWord = async (newWord, skipAI = false, manualData = {}) => {
    try {
      const payload = {
        word: newWord,
        skipAI,
        manualDefinition: manualData.manualDefinition,
        manualExamples: manualData.manualExample ? [manualData.manualExample] : [],
        manualTranslation: manualData.manualTranslation,
      };
      await addWordMutation(payload).unwrap();
      setIsAddModalOpen(false);
      toast.success(`"${newWord.trim()}" lug'atga qo'shildi — takrorlash navbatida`);
    } catch (err) {
      const errorData = err.data || err;
      const known = ['DUPLICATE', 'INVALID', 'QUOTA_EXCEEDED', 'ENRICHMENT_FAILED'];
      if (known.includes(errorData.type)) {
        throw errorData;
      }
      throw new Error("So'zni qo'shib bo'lmadi. Qayta urinib ko'ring.");
    }
  };

  // O'chirish qaytarib bo'lmaydi (so'zning butun takrorlash tarixi ketadi) —
  // ilgari bir bosishda, so'rovsiz bajarilardi va xato jim yutilardi
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteWordMutation(pendingDelete._id).unwrap();
      toast.success(`"${pendingDelete.word}" o'chirildi`);
      setPendingDelete(null);
    } catch {
      toast.error("O'chirib bo'lmadi. Internetni tekshirib qayta urining.");
    }
  };

  /**
   * Yodlangan so'zni qayta yodlashga qaytarish.
   * Server uni 4-bosqichdan (7 kun) boshlaydi — bir marta yodlangan so'zni
   * yangi so'z kabi 1 kundan boshlash keraksiz takrorlash bo'lardi.
   */
  const handleRelearn = async (id) => {
    setRelearningId(id);
    try {
      await relearnWordMutation(id).unwrap();
      toast.success("So'z qayta yodlashga qaytarildi — 7 kundan keyin chiqadi");
    } catch (err) {
      toast.error(err?.data?.message || "Amalni bajarib bo'lmadi. Qayta urining.");
    } finally {
      setRelearningId(null);
    }
  };

  /**
   * "Bilaman" — tanish so'zni takrorlashsiz yodlanganlarga o'tkazish.
   * Adashib bosilsa, kartochkadagi "Qayta yodlash" uni qaytaradi.
   */
  const handleMarkKnown = async (word) => {
    setMarkingKnownId(word._id);
    try {
      await markWordKnownMutation(word._id).unwrap();
      toast.success(`"${word.word}" yodlanganlarga qo'shildi — takrorlashda chiqmaydi`);
    } catch (err) {
      toast.error(err?.data?.message || "Amalni bajarib bo'lmadi. Qayta urining.");
    } finally {
      setMarkingKnownId(null);
    }
  };

  /**
   * Ta'rifsiz qolgan so'zni tuzatish.
   * Tarmoq uzilgan paytda qo'shilgan eski yozuvlar uchun — takrorlash
   * holatiga tegilmaydi, faqat kontent maydonlari yangilanadi.
   */
  const handleRefresh = async (id) => {
    setRefreshingId(id);
    try {
      await refreshWordMutation(id).unwrap();
      toast.success("Ma'lumot yangilandi");
    } catch (err) {
      toast.error(err?.data?.message || "Lug'at xizmati hozir javob bermadi. Keyinroq urining.");
    } finally {
      setRefreshingId(null);
    }
  };

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.value, words.filter((w) => matchesFilter(w, f.value)).length])),
    [words]
  );

  const visibleWords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...words]
      .filter((w) => matchesFilter(w, filter))
      .filter(
        (w) =>
          !q ||
          w.word.toLowerCase().includes(q) ||
          w.translation?.toLowerCase().includes(q) ||
          w.definition?.toLowerCase().includes(q)
      )
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [words, filter, searchQuery]);

  const shown = visibleWords.slice(0, limit);

  return (
    <div>
      <PageHeader
        eyebrow="Lug'at"
        title="Mening lug'atim"
        icon={BookOpen}
        description={
          isLoading
            ? 'Yuklanmoqda…'
            : `${words.length} ta so'z · ${counts.learned} tasi yodlangan · bugun ${counts.due} ta takrorlanadi`
        }
        actions={
          <Button size="lg" onClick={() => setIsAddModalOpen(true)} className="w-full sm:w-auto">
            <Plus /> So&apos;z qo&apos;shish
          </Button>
        }
      />

      {/* "Mavzular" kutubxonasi (250 mavzu, 3813 so'z) olib tashlandi: kursning
          o'zidan 4 baravar katta parallel dastur edi va "Hammasini qo'shish"
          takrorlash navbatini to'ldirib "kuniga 15 daqiqa"ni buzardi. Kontent
          serverda saqlanadi — kursning 91+ kunlari uchun xom ashyo. */}
        <>
          {/* Qidiruv va filtrlar */}
          <div className="glass sticky top-[calc(env(safe-area-inset-top,0px)+3.5rem)] z-30 -mx-4 mb-6 space-y-3 px-4 py-3 sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setLimit(PAGE_SIZE);
                }}
                placeholder="So'z, tarjima yoki ma'no bo'yicha qidirish"
                aria-label="Lug'atdan qidirish"
                className="h-12 w-full rounded-2xl border border-input bg-card pl-12 pr-11 text-base shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/80 focus:border-primary focus:ring-4 focus:ring-primary/15 [&::-webkit-search-cancel-button]:hidden"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Qidiruvni tozalash"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Segmented
              ariaLabel="So'zlarni saralash"
              layoutId="vocab-filter"
              value={filter}
              onChange={(v) => {
                setFilter(v);
                setLimit(PAGE_SIZE);
              }}
              options={FILTERS.map((f) => ({ ...f, count: isLoading ? null : counts[f.value] }))}
            />
          </div>

          {/* Ro'yxat */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Yuklanmoqda">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          ) : words.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Lug'atingiz hali bo'sh"
              description="Birinchi so'zingizni qo'shing — tarjima, ta'rif va darajangizga mos misol avtomatik topiladi."
            >
              <Button size="lg" onClick={() => setIsAddModalOpen(true)}>
                <Plus /> Birinchi so&apos;zni qo&apos;shish
              </Button>
            </EmptyState>
          ) : visibleWords.length === 0 ? (
            searchQuery ? (
              <EmptyState
                icon={SearchX}
                tone="muted"
                title="Hech narsa topilmadi"
                description={`"${searchQuery}" bo'yicha so'z yo'q. Uni lug'atga qo'shishni xohlaysizmi?`}
              >
                <Button variant="outline" onClick={() => setSearchQuery('')}>Qidiruvni tozalash</Button>
                <Button onClick={() => setIsAddModalOpen(true)}>
                  <Plus /> Qo&apos;shish
                </Button>
              </EmptyState>
            ) : (
              <EmptyState icon={CheckCircle2} tone="success" {...EMPTY_COPY[filter]} />
            )
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  {shown.map((word) => (
                    <WordCard
                      key={word._id}
                      word={word}
                      onDelete={setPendingDelete}
                      onRelearn={handleRelearn}
                      onMarkKnown={handleMarkKnown}
                      onRefresh={handleRefresh}
                      isRelearning={relearningId === word._id}
                      isMarkingKnown={markingKnownId === word._id}
                      isRefreshing={refreshingId === word._id}
                    />
                  ))}
                </AnimatePresence>
              </div>
              {visibleWords.length > shown.length && (
                <div className="mt-6 flex justify-center">
                  <Button variant="outline" size="lg" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                    Yana ko&apos;rsatish ({visibleWords.length - shown.length})
                  </Button>
                </div>
              )}
            </>
          )}
        </>

      {/* So'z qo'shish */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Yangi so&apos;z qo&apos;shish</DialogTitle>
            <DialogDescription>
              Inglizcha so&apos;zni yozing — tarjima, ta&apos;rif va darajangizga mos misol avtomatik topiladi.
            </DialogDescription>
          </DialogHeader>
          <WordForm onAddWord={handleAddWord} existingWords={words} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`"${pendingDelete?.word}" o'chirilsinmi?`}
        description="So'z va uning butun takrorlash tarixi o'chiriladi. Buni qaytarib bo'lmaydi."
        confirmLabel="O'chirish"
        destructive
        loading={isDeleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default Vocabulary;
