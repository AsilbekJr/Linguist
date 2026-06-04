import React from 'react';
import { useGetMeQuery, useGetWordsQuery, useGetChallengeHistoryQuery } from '../features/api/apiSlice';
import { Flame, Star, BookOpen, Target, Loader2, Award } from 'lucide-react';
import { BADGE_DEFINITIONS, computeLevelFromXp, xpProgressInLevel } from '../utils/learningUtils';

const Analytics = () => {
  const { data: user, isLoading: loadingUser } = useGetMeQuery();
  const { data: words = [], isLoading: loadingWords } = useGetWordsQuery();
  const { data: challenges = [], isLoading: loadingChallenges } = useGetChallengeHistoryQuery();

  const isLoading = loadingUser || loadingWords || loadingChallenges;
  const mastered = words.filter((w) => w.mastered).length;
  const completedChallenges = challenges.filter((c) => c.status === 'completed').length;
  const level = user?.level ?? computeLevelFromXp(user?.xp);
  const xpProgress = user?.xpProgress ?? xpProgressInLevel(user?.xp);
  const earnedBadgeIds = user?.badges || [];

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const stats = [
    { label: 'Total XP', value: user?.xp || 0, icon: Star, color: 'text-yellow-500' },
    { label: 'Daraja', value: level, icon: Award, color: 'text-primary' },
    { label: 'Kunlik streak', value: user?.currentStreak || 0, icon: Flame, color: 'text-orange-500' },
    { label: 'Eng uzun streak', value: user?.longestStreak || 0, icon: Flame, color: 'text-orange-400' },
    { label: "Lug'atdagi so'zlar", value: words.length, icon: BookOpen, color: 'text-purple-500' },
    { label: "O'zlashtirilgan", value: mastered, icon: Target, color: 'text-green-500' },
    { label: '100 kun challenge', value: completedChallenges, icon: Target, color: 'text-blue-500' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-black mb-2">Progress</h1>
        <p className="text-muted-foreground">O'rganish statistikangiz bir joyda.</p>
      </div>

      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex justify-between text-sm font-bold mb-2">
          <span>Daraja {level}</span>
          <span className="text-muted-foreground">
            {xpProgress.current}/{xpProgress.needed} XP
          </span>
        </div>
        <div className="w-full bg-secondary rounded-full h-3">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${xpProgress.percent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-5">
            <s.icon className={`w-6 h-6 mb-3 ${s.color}`} />
            <div className="text-2xl font-black">{s.value}</div>
            <div className="text-xs text-muted-foreground font-medium mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-bold mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-yellow-500" /> Nishonlar
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BADGE_DEFINITIONS.map((badge) => {
            const earned = earnedBadgeIds.includes(badge.id);
            return (
              <div
                key={badge.id}
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  earned ? 'border-green-500/40 bg-green-500/5' : 'border-border opacity-60'
                }`}
              >
                <span className="text-2xl">{badge.icon}</span>
                <div>
                  <p className="font-bold">{badge.title}</p>
                  <p className="text-xs text-muted-foreground">{badge.description}</p>
                  {earned && <p className="text-xs text-green-500 font-bold mt-1">Olingan</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="font-bold mb-2">Onboarding profili</h2>
        <p className="text-sm text-muted-foreground">
          Daraja: <span className="font-bold text-foreground">{user?.onboarding?.level || '—'}</span>
          {' · '}
          Maqsad: <span className="font-bold text-foreground">{user?.onboarding?.goal || '—'}</span>
          {' · '}
          Reja: <span className="font-bold text-foreground">{user?.onboarding?.planType || '—'}</span>
        </p>
      </div>
    </div>
  );
};

export default Analytics;
