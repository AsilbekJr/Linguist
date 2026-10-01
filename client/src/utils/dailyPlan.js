/**
 * Bugungi reja — bitta joyda hisoblanadi (bosh sahifa halqasi, sidebar).
 *
 * Takrorlanadigan so'z bo'lmagan kun (`reviewSkipped`, masalan yangi
 * foydalanuvchi) takrorlash rejaga KIRMAYDI. Ilgari u "bajarilgan" deb
 * sanalardi va odam saytga kirishi bilan "1/2" ko'rardi — hech narsa
 * qilmasdan yarim reja bajarilgandek.
 */
export const getDailyPlan = (user) => {
  const q = user?.dailyQuests || {};
  const isToday = Boolean(user?.today) && q.date === user.today;
  const topicDone = Boolean(isToday && q.topicCompleted);
  const reviewClosed = Boolean(isToday && q.reviewCompleted);
  const reviewSkipped = Boolean(reviewClosed && q.reviewSkipped);
  const reviewDone = reviewClosed && !reviewSkipped;

  const steps = [{ key: 'topic', done: topicDone }];
  if (!reviewSkipped) steps.push({ key: 'review', done: reviewDone });

  const done = steps.filter((s) => s.done).length;
  return {
    steps,
    topicDone,
    reviewDone,
    reviewSkipped,
    done,
    total: steps.length,
    allDone: done === steps.length,
  };
};
