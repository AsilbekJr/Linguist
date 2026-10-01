import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'motion/react';
import { Flame, Snowflake } from 'lucide-react';
import { cn } from '@/lib/utils';
import Logo from './brand/Logo';
import UserMenu from './Layout/UserMenu';
import { PRIMARY_NAV, PRACTICE_NAV, ACCOUNT_NAV } from './Layout/nav';
import { getDailyPlan } from '../utils/dailyPlan';

/**
 * Desktop sidebar (lg+). Telefon va planshetda o'rniga pastki tab-bar ishlaydi
 * (MobileNav). Faol element ostidagi fon bir joydan ikkinchisiga suzib o'tadi.
 *
 * NavGroup ataylab komponentdan TASHQARIDA e'lon qilingan — ilgari u render
 * ichida yaratilardi va har renderda butun menyu qayta mount bo'lardi.
 */
const NavItem = ({ item }) => (
  <NavLink
    to={item.to}
    end={item.end}
    className={({ isActive }) =>
      cn(
        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
        isActive ? 'text-primary' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
      )
    }
  >
    {({ isActive }) => (
      <>
        {isActive && (
          <motion.span
            layoutId="sidebar-active"
            className="absolute inset-0 rounded-xl bg-primary/10 ring-1 ring-primary/15"
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          />
        )}
        <item.icon className="relative z-10 size-[18px] shrink-0 transition-transform group-hover:scale-110" />
        <span className="relative z-10">{item.label}</span>
      </>
    )}
  </NavLink>
);

const NavGroup = ({ title, items }) => (
  <div className="space-y-0.5">
    {title && (
      <p className="px-3 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
        {title}
      </p>
    )}
    {items.map((item) => (
      <NavItem key={item.to} item={item} />
    ))}
  </div>
);

/** Streak — motivatsiyaning asosiy dvigateli, doim ko'z oldida tursin */
const StreakCard = ({ user }) => {
  const streak = user?.currentStreak || 0;
  const { steps, done, total } = getDailyPlan(user);

  return (
    <div className="surface noise overflow-hidden p-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'inline-flex size-10 items-center justify-center rounded-xl',
            streak > 0 ? 'bg-streak/15 text-streak' : 'bg-muted text-muted-foreground'
          )}
        >
          <Flame className={cn('size-5', streak > 0 && 'animate-flame')} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold leading-none tabular">
            {streak} <span className="text-sm font-semibold text-muted-foreground">kun</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">ketma-ket streak</p>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full bg-info/12 px-2 py-1 text-xs font-bold text-info"
          title="Streak muzlatish: bir kun o'tkazib yuborsangiz, streak saqlanadi"
        >
          <Snowflake className="size-3" />
          {user?.streakFreezesLeft ?? 0}
        </span>
      </div>
      <div className="mt-3.5 flex items-center gap-2">
        <div className="flex flex-1 gap-1.5">
          {steps.map((s) => (
            <span
              key={s.key}
              className={cn('h-1.5 flex-1 rounded-full transition-colors duration-500', s.done ? 'bg-success' : 'bg-muted')}
            />
          ))}
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground tabular">{done}/{total} bugun</span>
      </div>
    </div>
  );
};

const Sidebar = ({ user }) => (
  <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] flex-col border-r border-border bg-sidebar lg:flex">
    <div className="px-5 pb-4 pt-6">
      <NavLink to="/" aria-label="Bosh sahifa" className="inline-flex rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Logo />
      </NavLink>
    </div>

    <div className="px-4">
      <StreakCard user={user} />
    </div>

    <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4 pt-3" aria-label="Asosiy menyu">
      <NavGroup items={PRIMARY_NAV} />
      <NavGroup title="Qo'shimcha" items={PRACTICE_NAV} />
      <NavGroup title="Hisob" items={ACCOUNT_NAV} />
    </nav>

    <div className="border-t border-border p-3">
      <UserMenu user={user} side="top" align="start" />
    </div>
  </aside>
);

export default Sidebar;
