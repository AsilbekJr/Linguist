import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useGetWordsQuery, useGetReviewDueQuery } from '../features/api/apiSlice';
import { Link } from 'react-router-dom';
import { Play, Flame, BookOpen, Brain, Mic } from 'lucide-react';
import { groupWordsByDate } from '../utils/dateUtils';

const Dashboard = () => {
  const user = useSelector((state) => state.auth.user);
  
  const { data: words = [] } = useGetWordsQuery();
  const { data: reviewDueList } = useGetReviewDueQuery();
  
  const reviewDueCount = reviewDueList ? reviewDueList.length : 0;
  const totalWords = words.length;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
      
      {/* Welcome Section */}
      <section className="bg-gradient-to-br from-card to-card/50 p-8 rounded-3xl border border-border shadow-sm">
        <h1 className="text-3xl md:text-5xl font-black mb-4">
          Xush kelibsiz, <span className="bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">{user?.name}</span> 👋
        </h1>
        <p className="text-muted-foreground text-lg mb-8 max-w-2xl text-balance">
          Bugun ingliz tilida erkin gapirish sari yana bir qadam tashlaymiz. Asosiy vazifalaringiz tayyor!
        </p>
      </section>

      {/* Primary Action Needs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Priority 1: Review */}
        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors"></div>
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Brain className="w-6 h-6" />
            </div>
            {reviewDueCount > 0 && (
                <span className="bg-destructive text-destructive-foreground px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                  {reviewDueCount} ta so'z
                </span>
            )}
          </div>
          <h2 className="text-2xl font-bold mb-2 relative z-10">Spaced Repetition</h2>
          <p className="text-muted-foreground text-sm mb-6 relative z-10">
            Miyangiz so'zlarni unutmasligi uchun eng muhim qadam.
          </p>
          <Link 
            to="/review" 
            className="w-full inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-xl font-bold transition-all mt-auto z-10 relative"
          >
            <Play className="w-4 h-4 fill-current" /> 
            {reviewDueCount > 0 ? "Takrorlashni boshlash" : "Takrorlash (Hozircha bo'sh)"}
          </Link>
        </div>

        {/* Priority 2: Challenge */}
        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-3xl group-hover:bg-orange-500/10 transition-colors"></div>
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center">
              <Flame className="w-6 h-6" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2 relative z-10">100 Days Challenge</h2>
          <p className="text-muted-foreground text-sm mb-6 relative z-10">
            Kichik qadamlar, katta natijalar. Bugungi yodlash mashqini bajaring.
          </p>
          <Link 
            to="/challenge" 
            className="w-full inline-flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground py-3 rounded-xl font-bold transition-all mt-auto z-10 relative"
          >
            Vazifalarni ko'rish
          </Link>
        </div>

        {/* Priority 3: Daily Topics */}
        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl group-hover:bg-purple-500/10 transition-colors"></div>
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2 relative z-10">Daily Topics</h2>
          <p className="text-muted-foreground text-sm mb-6 relative z-10">
            Har kuni bitta aniq mavzu doirasida yangi 5ta eng kerakli so'zni o'rganing.
          </p>
          <Link 
            to="/topic" 
            className="w-full inline-flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white py-3 rounded-xl font-bold transition-all mt-auto z-10 relative"
          >
            Lug'atni boshlash
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
        
        <Link to="/movie-lab" className="bg-card border border-border p-6 rounded-3xl hover:border-primary/50 transition-colors flex items-center gap-4 group">
           <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Play className="w-5 h-5" />
           </div>
           <div>
              <h4 className="font-bold">Movie Lab</h4>
              <p className="text-xs text-muted-foreground mt-1">Kinolar orqali Shadowing</p>
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
