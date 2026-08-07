import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useGetWordsQuery, useGetReviewDueQuery, useGetMeQuery } from '../features/api/apiSlice';
import { Link } from 'react-router-dom';
import { Flame, BookOpen, Mic, Star, Quote, ArrowRight, GraduationCap, Headphones } from 'lucide-react';
import quotesData from '../data/quotes.json';
import TodayHub from '../components/TodayHub/TodayHub';
import { getGoalRecommendation } from '../utils/learningUtils';

const Dashboard = () => {
  const authUser = useSelector((state) => state.auth.user);
  const { data: fetchedUser, isLoading: isLoadingUser } = useGetMeQuery();
  const user = fetchedUser || authUser;

  const { data: words = [], isLoading: isLoadingWords } = useGetWordsQuery();
  const { data: reviewDueList, isLoading: isLoadingReview } = useGetReviewDueQuery();

  const isLoading = isLoadingUser || isLoadingWords || isLoadingReview;
  const reviewDueCount = reviewDueList ? reviewDueList.length : 0;
  const totalWords = words.length;

  const goalRec = useMemo(
    () => getGoalRecommendation(user?.onboarding?.goal),
    [user?.onboarding?.goal]
  );

  const dailyQuote = useMemo(() => {
    const msPerDay = 1000 * 60 * 60 * 24;
    const todayInt = Math.floor(Date.now() / msPerDay);
    const index = todayInt % quotesData.length;
    return quotesData[index];
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 animate-pulse">
        <section className="bg-card p-8 rounded-3xl border h-32" />
        <section className="bg-card p-8 rounded-3xl border h-48" />
        <section className="bg-card p-8 rounded-3xl border h-64" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
      <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 rounded-3xl p-4 sm:p-6 relative overflow-hidden flex flex-col md:flex-row items-center gap-6 justify-between shadow-sm">
        <Quote className="absolute -top-4 -left-4 w-24 h-24 text-primary/10 rotate-180 pointer-events-none" />
        <div className="relative z-10 flex-grow">
          <p className="text-lg md:text-xl font-medium italic text-foreground mb-2">&quot;{dailyQuote.text}&quot;</p>
          <p className="text-sm text-muted-foreground font-medium">{dailyQuote.translation}</p>
        </div>
        <div className="relative z-10 shrink-0">
          <span className="text-sm font-bold opacity-80">{dailyQuote.author}</span>
        </div>
      </div>

      <Link
        to={goalRec.path}
        className="block bg-card border border-primary/30 rounded-2xl p-4 hover:border-primary/60 transition-colors"
      >
        <p className="text-xs font-bold uppercase text-primary mb-1">Shaxsiy tavsiya</p>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-lg">{goalRec.label}</h3>
            <p className="text-sm text-muted-foreground">{goalRec.hint}</p>
          </div>
          <ArrowRight className="w-5 h-5 text-primary shrink-0" />
        </div>
      </Link>

      <section className="bg-gradient-to-br from-card to-card/50 p-4 sm:p-6 md:p-8 rounded-3xl border border-border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-black mb-3 break-words">
            Xush kelibsiz,{' '}
            <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
              {user?.name}
            </span>{' '}
            👋
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl">
            Quyidagi 3 qadamni ketma-ket bajaring — shunda kunlik reja tugaydi.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 sm:gap-4 items-center shrink-0">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl border ${
              user?.currentStreak > 0
                ? 'bg-orange-500/10 border-orange-500/20 text-orange-500'
                : 'bg-muted border-border text-muted-foreground'
            }`}
          >
            <Flame className={`w-6 h-6 ${user?.currentStreak > 0 ? 'animate-pulse' : ''}`} />
            <div>
              <div className="text-xl font-black">{user?.currentStreak || 0}</div>
              <div className="text-[10px] uppercase font-bold tracking-wider">Streak</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-500">
            <Star className="w-6 h-6 fill-current" />
            <div>
              <div className="text-xl font-black">{user?.xp || 0}</div>
              <div className="text-[10px] uppercase font-bold tracking-wider">
                XP · Lv.{user?.level || 1}
              </div>
            </div>
          </div>
        </div>
      </section>

      <TodayHub user={user} reviewDueCount={reviewDueCount} totalWords={totalWords} />

      <div>
        <h3 className="text-xl font-bold mb-4">Qo'shimcha mashqlar</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            to="/tutor"
            className="bg-card border border-indigo-500/30 p-5 rounded-2xl hover:border-indigo-500/60 transition-colors flex items-center gap-4"
          >
            <GraduationCap className="w-5 h-5 text-indigo-500" />
            <div>
              <h4 className="font-bold">Ustoz AI</h4>
              <p className="text-xs text-muted-foreground">Grammatika va iboralar</p>
            </div>
          </Link>
          <Link
            to="/listening"
            className="bg-card border border-teal-500/30 p-5 rounded-2xl hover:border-teal-500/60 transition-colors flex items-center gap-4"
          >
            <Headphones className="w-5 h-5 text-teal-500" />
            <div>
              <h4 className="font-bold">Tinglash</h4>
              <p className="text-xs text-muted-foreground">Eshitib yozish</p>
            </div>
          </Link>
          <Link
            to="/speaking"
            className="bg-card border border-border p-5 rounded-2xl hover:border-primary/50 transition-colors flex items-center gap-4"
          >
            <Mic className="w-5 h-5 text-blue-500" />
            <div>
              <h4 className="font-bold">Speaking Lab</h4>
              <p className="text-xs text-muted-foreground">Gapirish mashqi</p>
            </div>
          </Link>
          <Link
            to="/challenge"
            className="bg-card border border-border p-5 rounded-2xl hover:border-primary/50 transition-colors flex items-center gap-4"
          >
            <Flame className="w-5 h-5 text-orange-500" />
            <div>
              <h4 className="font-bold">100 kun bonus</h4>
              <p className="text-xs text-muted-foreground">Kunlik challenge</p>
            </div>
          </Link>
          <Link
            to="/vocabulary"
            className="bg-card border border-border p-5 rounded-2xl hover:border-primary/50 transition-colors flex items-center gap-4"
          >
            <BookOpen className="w-5 h-5 text-purple-500" />
            <div>
              <h4 className="font-bold">Lug'at</h4>
              <p className="text-xs text-muted-foreground">{totalWords} ta so'z</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
