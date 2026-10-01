import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { BookOpen, BookHeart, PartyPopper, Plus, Repeat2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconTile, Skeleton } from '@/components/ui/primitives';
import { fireConfetti } from '../../utils/celebration';
import { track, EVENTS } from '../../lib/analytics';
import { toast } from 'react-hot-toast';
import { useGetReviewDueQuery, useCompleteReviewDayMutation, useGetPhrasesDueQuery } from '../../features/api/apiSlice';
import ReviewRunner from './ReviewRunner';
import PhraseReview from './PhraseReview';

/**
 * "Bugun" — kunlik takrorlashning O'ZI.
 *
 * Ilgari bu sahifa uchta qadam kartochkasi bo'lib, har biri boshqa sahifaga
 * olib borardi. Takrorlash uchun foydalanuvchi "Bugun" → "Takrorlash" →
 * so'z, ya'ni ikki ortiqcha bosish qilardi va bir xil ish ikki joyda turardi.
 * Endi navbat shu yerda ochiladi.
 */
const TodayHub = ({ user, totalWords = 0 }) => {
  const { data: dueWords = [], isLoading, isFetching, refetch } = useGetReviewDueQuery();
  const [completeReviewDay] = useCompleteReviewDayMutation();
  // Sahnada yodlangan iboralar — so'zlardan oldin. Sessiya boshida muzlatiladi:
  // javobdan keyin ro'yxat qayta yuklansa ham karta ko'z oldidan yo'qolmasin
  const { data: duePhrases = [], isFetching: phrasesFetching, refetch: refetchPhrases } = useGetPhrasesDueQuery();
  const [phraseSession, setPhraseSession] = useState(null);
  const [phrasesDone, setPhrasesDone] = useState(false);
  useEffect(() => {
    if (!phraseSession && !phrasesDone && !phrasesFetching && duePhrases.length > 0) setPhraseSession(duePhrases);
  }, [duePhrases, phraseSession, phrasesDone, phrasesFetching]);
  const phrasesActive = Boolean(phraseSession?.length) && !phrasesDone;

  const [finished, setFinished] = useState(false);
  const celebratedRef = useRef(false);

  /**
   * Sessiya boshlanganda navbat MUZLATILADI.
   *
   * Busiz shunday bo'lardi: javob yuborilgach `checkReview` 'Word' tegini
   * bekor qiladi → `getReviewDue` qayta yuklanadi → so'z endi navbatda yo'q
   * (keyingi takrorlash ertaga) → ro'yxat bo'shaydi va ReviewRunner
   * natijani ko'rsatishga ulgurmasdan yo'q bo'ladi. Foydalanuvchi javobi
   * to'g'ri chiqdimi yoki yo'qmi — bilmay qolardi.
   */
  const [session, setSession] = useState(null);
  // Shu ochilishda takrorlangan so'zlar. Sessiya tugagach navbat qayta
  // yuklanadi va unda hali eski (keshdagi) so'zlar bo'lishi mumkin — ular
  // yangi sessiyaga qayta tushmasligi kerak.
  const reviewedIdsRef = useRef(new Set());

  useEffect(() => {
    if (session || isFetching) return;
    const fresh = dueWords.filter((w) => !reviewedIdsRef.current.has(w._id));
    if (fresh.length > 0) {
      setFinished(false);
      setSession(fresh);
    }
  }, [dueWords, session, isFetching]);

  // "Bugun" — foydalanuvchi zonasidagi kun, SERVER hisoblaydi. Ilgari bu yerda
  // UTC sana olinardi va Toshkentda 00:00–05:00 oralig'ida belgi noto'g'ri edi.
  const quests = user?.dailyQuests || {};
  const reviewDoneToday = Boolean(user?.today) && quests.date === user.today && quests.reviewCompleted;
  // Qadam yopilgan, lekin hech narsa takrorlanmagan (navbat bo'sh edi) — "bajarildi" deb ko'rsatilmaydi
  const reviewedToday = reviewDoneToday && !quests.reviewSkipped;

  /** Server qaytargan kunlik reja natijasi — xabar va bayram */
  const handleDailyStep = (step) => {
    if (!step) return;
    if (step.message) toast.success(step.message);
    if (step.planCompleted && step.streakUpdated && !celebratedRef.current) {
      celebratedRef.current = true;
      fireConfetti(1500);
      track(EVENTS.DAILY_PLAN_COMPLETED, {
        streak: step.currentStreak,
        level: user?.level,
        totalWords,
      });
    }
  };

  /**
   * Navbat bo'sh kun: takrorlash qadamini yopamiz. Busiz takrorlaydigan so'zi
   * yo'q foydalanuvchi kunlik rejani hech qachon tugata olmasdi va streak'i
   * qotib qolardi. Server navbatni o'zi tekshiradi.
   */
  const closingDayRef = useRef(false);
  useEffect(() => {
    if (isLoading || isFetching || session || dueWords.length > 0) return;
    // Ibora kartalari ham takrorlash qadamining bir qismi
    if (phrasesActive || phrasesFetching || duePhrases.length > 0) return;
    if (!user?.today || reviewDoneToday || closingDayRef.current) return;
    closingDayRef.current = true;
    completeReviewDay()
      .unwrap()
      .then(handleDailyStep)
      .catch(() => {
        // 409 — navbatda so'z paydo bo'lgan; keyingi yuklanishda qayta uriniladi
        closingDayRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isFetching, session, dueWords.length, user?.today, reviewDoneToday, phrasesActive, phrasesFetching, duePhrases.length]);

  const handleChecked = (wordId, result) => {
    reviewedIdsRef.current.add(wordId);
    handleDailyStep(result?.dailyStep);
  };

  // Navbat tugadi — qadamni server /check ichida allaqachon belgilagan
  const handleFinished = () => {
    setFinished(true);
    setSession(null);
    // Xato qilingan yoki sahnadan qo'shilgan so'zlar navbatga tushgan bo'lishi mumkin
    refetch();
  };

  const remaining =
    (session?.length ?? dueWords.length) + (phrasesDone ? 0 : phraseSession?.length ?? duePhrases.length);

  /** Navbat bo'sh — bu yaxshi holat, uni muvaffaqiyat sifatida ko'rsatamiz */
  const emptyState = (
    <motion.div
      key="empty"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center py-6 text-center sm:py-10"
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 -z-10 scale-150 rounded-full bg-success/15 blur-2xl" />
        <IconTile
          icon={totalWords === 0 ? BookOpen : PartyPopper}
          tone={totalWords === 0 ? 'primary' : 'success'}
          size="lg"
          className="animate-float"
        />
      </div>
      <h3 className="text-xl font-extrabold">
        {finished
          ? 'Bugungi takrorlash tugadi!'
          : totalWords === 0
            ? "Lug'atingiz hali bo'sh"
            : "Bugun takrorlanadigan so'z yo'q"}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {totalWords === 0
          ? "Takrorlash so'zlardan boshlanadi. Kunlik sahnadan tayyor so'zlarni oling yoki lug'atga o'zingiz qo'shing."
          : "Hamma so'z o'z jadvalida. Yangi qo'shilgan so'z shu zahoti navbatga tushadi."}
      </p>

      <div className="mt-6 flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">
        <Button asChild size="lg">
          <Link to="/topic">
            <BookHeart /> Kunlik sahna
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link to="/vocabulary">
            {totalWords === 0 ? <Plus /> : <BookOpen />} Lug&apos;atga o&apos;tish
          </Link>
        </Button>
      </div>
    </motion.div>
  );

  return (
    <section className="surface relative overflow-hidden p-4 sm:p-6 md:p-8" aria-labelledby="review-title">
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/6 blur-3xl" />

      <header className="relative mb-5 flex items-center gap-3 sm:mb-6">
        <IconTile icon={Repeat2} tone="primary" />
        <div className="min-w-0 flex-1">
          <h2 id="review-title" className="text-xl font-extrabold sm:text-2xl">Takrorlash</h2>
          <p className="text-sm text-muted-foreground">Tanib oling, eslang, gapda ishlating — so&apos;z o&apos;rganilgan sari topshiriq qiyinlashadi</p>
        </div>
        {reviewedToday ? (
          <Badge variant="success" className="hidden sm:inline-flex">
            <CheckCircle2 /> Bugun bajarildi
          </Badge>
        ) : remaining > 0 ? (
          <Badge variant="soft" className="tabular">{remaining} ta karta</Badge>
        ) : null}
      </header>

      <div className="relative">
        <AnimatePresence mode="wait" initial={false}>
          {isLoading ? (
            <motion.div key="loading" exit={{ opacity: 0 }} className="space-y-4" aria-busy="true">
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-12 rounded-xl" />
            </motion.div>
          ) : phrasesActive ? (
            <motion.div
              key="phrases"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <PhraseReview
                phrases={phraseSession}
                onChecked={(_id, res) => handleDailyStep(res?.dailyStep)}
                onFinished={() => {
                  setPhrasesDone(true);
                  refetch();
                  refetchPhrases();
                }}
              />
            </motion.div>
          ) : session?.length ? (
            <motion.div
              key="session"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {reviewedToday && (
                <p className="mb-3 rounded-xl bg-success/8 px-3 py-2 text-xs font-medium text-success">
                  Bugungi reja bajarilgan — bular qo&apos;shimcha takrorlash.
                </p>
              )}
              <ReviewRunner words={session} onChecked={handleChecked} onFinished={handleFinished} />
            </motion.div>
          ) : (
            emptyState
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default TodayHub;
