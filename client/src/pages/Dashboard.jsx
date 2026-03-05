import React, { useMemo, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useGetWordsQuery, useGetReviewDueQuery, useGetMeQuery } from '../features/api/apiSlice';
import { Link } from 'react-router-dom';
import { Play, Flame, BookOpen, Brain, Mic, CheckCircle2, Circle, Trophy, Star, Quote } from 'lucide-react';
import { groupWordsByDate } from '../utils/dateUtils';
import quotesData from '../data/quotes.json';

const Dashboard = () => {
  const authUser = useSelector((state) => state.auth.user);
  const { data: fetchedUser, isLoading: isLoadingUser } = useGetMeQuery();
  const user = fetchedUser || authUser;
  
  const { data: words = [], isLoading: isLoadingWords } = useGetWordsQuery();
  const { data: reviewDueList, isLoading: isLoadingReview } = useGetReviewDueQuery();
  
  const isLoading = isLoadingUser || isLoadingWords || isLoadingReview;

  const reviewDueCount = reviewDueList ? reviewDueList.length : 0;
  const totalWords = words.length;

  const quests = user?.dailyQuests || {};
  const today = new Date().toISOString().split('T')[0];
  
  // Checking if they are actually active today
  const isReviewDone = quests.date === today && quests.reviewCompleted;
  const isTopicDone = quests.date === today && quests.topicCompleted;
  const isImmersionDone = quests.date === today && quests.immersionCompleted;

  const completedCount = [isReviewDone, isTopicDone, isImmersionDone].filter(Boolean).length;
  const progressPercent = (completedCount / 3) * 100;

  // Daily Quote logic (changes once per day based on date)
  const dailyQuote = useMemo(() => {
     const msPerDay = 1000 * 60 * 60 * 24;
     const todayInt = Math.floor(Date.now() / msPerDay);
     const index = todayInt % quotesData.length;
     return quotesData[index];
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 animate-pulse text-transparent">
        {/* Welcome Skeleton */}
        <section className="bg-card p-6 md:p-8 rounded-3xl border border-border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
           <div className="space-y-4 w-full max-w-md">
              <div className="h-10 md:h-12 bg-muted rounded-xl w-3/4"></div>
              <div className="h-4 bg-muted rounded-md w-full"></div>
              <div className="h-4 bg-muted rounded-md w-5/6"></div>
           </div>
           <div className="flex gap-4 shrink-0 mt-4 md:mt-0">
              <div className="h-14 w-28 bg-muted rounded-2xl"></div>
              <div className="h-14 w-28 bg-muted rounded-2xl"></div>
           </div>
        </section>

        {/* Quests Skeleton */}
        <div className="bg-card border border-border rounded-3xl shadow-sm p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div className="space-y-3">
                    <div className="h-8 bg-muted rounded-xl w-64 md:w-80"></div>
                    <div className="h-4 bg-muted rounded-md w-48 md:w-64"></div>
                </div>
                <div className="w-full md:w-48 bg-muted rounded-full h-3"></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="h-40 bg-muted rounded-2xl"></div>
               <div className="h-40 bg-muted rounded-2xl"></div>
               <div className="h-40 bg-muted rounded-2xl"></div>
            </div>
        </div>

        {/* Secondary Actions Skeleton */}
        <div className="space-y-6 mt-12">
            <div className="h-6 bg-muted rounded-md w-48 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="h-24 bg-muted rounded-3xl"></div>
               <div className="h-24 bg-muted rounded-3xl"></div>
               <div className="h-24 bg-muted rounded-3xl"></div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
      
      {/* Daily Quote Section */}
      <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 rounded-3xl p-6 relative overflow-hidden flex flex-col md:flex-row items-center gap-6 justify-between shadow-sm">
         <Quote className="absolute -top-4 -left-4 w-24 h-24 text-primary/10 rotate-180 pointer-events-none" />
         <div className="relative z-10 flex-grow">
            <p className="text-lg md:text-xl font-medium italic text-foreground mb-2">"{dailyQuote.text}"</p>
            <p className="text-sm text-muted-foreground font-medium mb-1">{dailyQuote.translation}</p>
         </div>
         <div className="relative z-10 shrink-0 text-right">
             <div className="inline-flex items-center gap-2 bg-background px-4 py-2 rounded-full shadow-sm border border-border">
                 <span className="w-2 h-2 rounded-full bg-primary/70"></span>
                 <span className="text-sm font-bold opacity-80">{dailyQuote.author}</span>
             </div>
         </div>
      </div>

      {/* Welcome & Stats Section */}
      <section className="bg-gradient-to-br from-card to-card/50 p-6 md:p-8 rounded-3xl border border-border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
            <h1 className="text-3xl md:text-5xl font-black mb-3">
            Xush kelibsiz, <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">{user?.name}</span> 👋
            </h1>
            <p className="text-muted-foreground text-base md:text-lg max-w-xl text-balance">
            Kunlik vazifalarni bajaring, XP yig'ing va o'z intizomingizni saqlang!
            </p>
        </div>
        <div className="flex gap-4 items-center shrink-0">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border ${user?.currentStreak > 0 ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' : 'bg-muted border-border text-muted-foreground'}`}>
                <Flame className={`w-6 h-6 ${user?.currentStreak > 0 ? 'animate-pulse' : ''}`} />
                <div>
                    <div className="text-xl font-black">{user?.currentStreak || 0}</div>
                    <div className="text-[10px] uppercase font-bold tracking-wider">Kunlik Streak</div>
                </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-500">
                <Star className="w-6 h-6 fill-current" />
                <div>
                    <div className="text-xl font-black">{user?.xp || 0}</div>
                    <div className="text-[10px] uppercase font-bold tracking-wider">Total XP</div>
                </div>
            </div>
        </div>
      </section>

      {/* Daily Quests Section */}
      <div className="bg-card border border-border rounded-3xl shadow-sm p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 relative z-10">
            <div>
                <h2 className="text-2xl md:text-3xl font-black flex items-center gap-3">
                    <Trophy className="w-8 h-8 text-primary" /> Bugungi Vazifalar (Daily Quests)
                </h2>
                <p className="text-muted-foreground mt-2 font-medium">Til o'rganish — bu har kungi kichik odatlar yig'indisi. Barchasini yakunlang!</p>
            </div>
            
            <div className="w-full md:w-48 bg-secondary rounded-full h-3 border border-border/50 relative overflow-hidden shrink-0 mt-4 md:mt-0">
               <div className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }}></div>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            
            {/* Quest 1: Review */}
            <Link to="/review" className={`p-5 rounded-2xl border-2 transition-all flex flex-col group ${isReviewDone ? 'border-green-500 bg-green-500/5' : 'border-border hover:border-primary/50 bg-background'}`}>
                <div className="flex justify-between items-start mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isReviewDone ? 'bg-green-500/20 text-green-500' : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors'}`}>
                        <Brain className="w-6 h-6" />
                    </div>
                    {isReviewDone ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <Circle className="w-6 h-6 text-muted-foreground opacity-30" />}
                </div>
                <h3 className="text-xl font-bold mb-1">Takrorlash</h3>
                <p className="text-sm text-muted-foreground mb-4">Eski so'zlarni xotirada tiklang.</p>
                {reviewDueCount > 0 && !isReviewDone && (
                    <span className="text-xs font-bold text-destructive bg-destructive/10 px-2 py-1 rounded inline-block w-fit mt-auto animate-pulse">
                        {reviewDueCount} ta so'z kutmoqda
                    </span>
                )}
                {isReviewDone && <span className="text-xs font-bold text-green-500 mt-auto uppercase tracking-wide">Bajarildi ✅</span>}
            </Link>

            {/* Quest 2: Daily Topic */}
            <Link to="/topic" className={`p-5 rounded-2xl border-2 transition-all flex flex-col group ${isTopicDone ? 'border-green-500 bg-green-500/5' : 'border-border hover:border-primary/50 bg-background'}`}>
                <div className="flex justify-between items-start mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isTopicDone ? 'bg-green-500/20 text-green-500' : 'bg-purple-500/10 text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors'}`}>
                        <BookOpen className="w-6 h-6" />
                    </div>
                    {isTopicDone ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <Circle className="w-6 h-6 text-muted-foreground opacity-30" />}
                </div>
                <h3 className="text-xl font-bold mb-1">Yangi Qon</h3>
                <p className="text-sm text-muted-foreground mb-4">Bugungi mavzu doirasida yangi 5ta so'z o'rganing.</p>
                {isTopicDone ? <span className="text-xs font-bold text-green-500 mt-auto uppercase tracking-wide">Bajarildi ✅</span> : <span className="text-xs font-bold text-primary mt-auto">Boshlash &rarr;</span>}
            </Link>

            {/* Quest 3: Immersion / Challenge */}
            <Link to="/roleplay" className={`p-5 rounded-2xl border-2 transition-all flex flex-col group ${isImmersionDone ? 'border-green-500 bg-green-500/5' : 'border-border hover:border-primary/50 bg-background'}`}>
                <div className="flex justify-between items-start mb-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isImmersionDone ? 'bg-green-500/20 text-green-500' : 'bg-teal-500/10 text-teal-500 group-hover:bg-teal-500 group-hover:text-white transition-colors'}`}>
                        <Mic className="w-6 h-6" />
                    </div>
                    {isImmersionDone ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <Circle className="w-6 h-6 text-muted-foreground opacity-30" />}
                </div>
                <h3 className="text-xl font-bold mb-1">Amaliyot</h3>
                <p className="text-sm text-muted-foreground mb-4">AI bilan gaplashib so'zlarni extends ishlatib ko'ring.</p>
                {isImmersionDone ? <span className="text-xs font-bold text-green-500 mt-auto uppercase tracking-wide">Bajarildi ✅</span> : <span className="text-xs font-bold text-primary mt-auto">Boshlash &rarr;</span>}
            </Link>
            
        </div>
      </div>

      {/* Secondary Actions */}
      <h3 className="text-xl font-bold mt-12 mb-6">Amaliyot va Baza</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <Link to="/speaking" className="bg-card border border-border p-6 rounded-3xl hover:border-primary/50 transition-colors flex items-center gap-4 group">
           <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Mic className="w-5 h-5" />
           </div>
           <div>
              <h4 className="font-bold">Speaking Lab</h4>
              <p className="text-xs text-muted-foreground mt-1">Talaffuzni mashq qilish</p>
           </div>
        </Link>
        

        
        <Link to="/roleplay" className="bg-card border border-border p-6 rounded-3xl hover:border-primary/50 transition-colors flex items-center gap-4 group">
           <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Mic className="w-5 h-5" />
           </div>
           <div>
              <h4 className="font-bold">AI Immersion</h4>
              <p className="text-xs text-muted-foreground mt-1">Sun'iy intellekt bilan suhbat</p>
           </div>
        </Link>
        
        <Link to="/vocabulary" className="bg-card border border-border p-6 rounded-3xl hover:border-primary/50 transition-colors flex items-center gap-4 group">
           <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen className="w-5 h-5" />
           </div>
           <div>
              <h4 className="font-bold">Mening Lug'atim</h4>
              <p className="text-xs text-muted-foreground mt-1">{totalWords} ta so'z bazada</p>
           </div>
        </Link>

      </div>

    </div>
  );
};

export default Dashboard;
