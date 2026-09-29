import React, { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import { Flame, LayoutGrid, BarChart3, ChevronRight, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { IconTile } from '@/components/ui/primitives';
import { useScrolled } from '../../hooks/useScrolled';
import { LogoMark } from '../brand/Logo';
import UserMenu from './UserMenu';
import { PRIMARY_NAV, PRACTICE_NAV, PRACTICE_PATHS, titleForPath } from './nav';

/**
 * Telefon va planshet navigatsiyasi (lg dan kichik).
 *
 * Ilgari telefonda faqat hamburger menyu bor edi — har bir o'tish uchun ikki
 * bosish, menyu esa bosh barmoq yetmaydigan yuqori chap burchakda. Endi asosiy
 * bo'limlar pastki tab-barda, ikkinchi darajalilari "Mashqlar" varag'ida.
 */

export const MobileTopBar = ({ user }) => {
  const { pathname } = useLocation();
  const scrolled = useScrolled();
  const title = pathname === '/' ? null : titleForPath(pathname);
  const streak = user?.currentStreak || 0;

  return (
    <header
      className={cn(
        'glass sticky top-0 z-40 border-b pt-safe transition-[border-color,box-shadow] duration-300 lg:hidden',
        scrolled ? 'border-border shadow-sm' : 'border-transparent'
      )}
    >
      <div className="flex h-14 items-center gap-3 px-4">
        <Link to="/" aria-label="Bosh sahifa" className="shrink-0">
          <LogoMark className="size-8" />
        </Link>
        <p className="min-w-0 flex-1 truncate text-[17px] font-extrabold tracking-tight">
          {title || 'Linguist'}
        </p>
        <Link
          to="/"
          className={cn(
            'inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-bold tabular',
            streak > 0 ? 'bg-streak/12 text-streak' : 'bg-muted text-muted-foreground'
          )}
          aria-label={`${streak} kunlik streak`}
        >
          <Flame className={cn('size-4', streak > 0 && 'animate-flame')} />
          {streak}
        </Link>
        <UserMenu user={user} variant="avatar" />
      </div>
    </header>
  );
};

const TabLink = ({ to, end, icon: Icon, label }) => (
  <NavLink
    to={to}
    end={end}
    className="relative flex flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1.5 focus-visible:outline-none"
  >
    {({ isActive }) => <TabInner isActive={isActive} icon={Icon} label={label} />}
  </NavLink>
);

const TabInner = ({ isActive, icon: Icon, label }) => (
  <>
    <span className="relative flex h-8 w-14 items-center justify-center">
      {isActive && (
        <motion.span
          layoutId="tab-active"
          className="absolute inset-0 rounded-full bg-primary/14"
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      )}
      <Icon
        className={cn(
          'relative size-[22px] transition-[color,transform] duration-200',
          isActive ? 'scale-105 text-primary' : 'text-muted-foreground'
        )}
        strokeWidth={isActive ? 2.4 : 2}
      />
    </span>
    <span className={cn('text-[11px] font-semibold leading-none', isActive ? 'text-primary' : 'text-muted-foreground')}>
      {label}
    </span>
  </>
);

export const MobileTabBar = () => {
  const { pathname } = useLocation();
  const [practiceOpen, setPracticeOpen] = useState(false);
  const practiceActive = PRACTICE_PATHS.some((p) => pathname.startsWith(p));

  return (
    <>
      <nav
        className="glass fixed inset-x-0 bottom-0 z-40 border-t border-border pb-safe lg:hidden"
        aria-label="Asosiy menyu"
      >
        <div className="mx-auto flex max-w-lg items-stretch px-1">
          {PRIMARY_NAV.map((item) => (
            <TabLink key={item.to} to={item.to} end={item.end} icon={item.icon} label={item.short || item.label} />
          ))}
          <button
            type="button"
            onClick={() => setPracticeOpen(true)}
            className="relative flex flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1.5 focus-visible:outline-none"
            aria-haspopup="dialog"
            aria-expanded={practiceOpen}
          >
            <TabInner isActive={practiceActive} icon={LayoutGrid} label="Mashqlar" />
          </button>
          <TabLink to="/analytics" icon={BarChart3} label="Natijalar" />
        </div>
      </nav>

      <Sheet open={practiceOpen} onOpenChange={setPracticeOpen}>
        <SheetContent side="bottom" className="px-4">
          <SheetHeader className="px-1">
            <SheetTitle>Mashqlar</SheetTitle>
            <SheetDescription>Kunlik rejaga qo&apos;shimcha — o&apos;zingizga mosini tanlang.</SheetDescription>
          </SheetHeader>
          <div className="mt-2 grid gap-2">
            {PRACTICE_NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setPracticeOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-2xl border p-3 transition-colors active:scale-[0.99]',
                  pathname.startsWith(item.to)
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border bg-card hover:bg-accent'
                )}
              >
                <IconTile icon={item.icon} tone={item.tone} />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{item.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
            <Link
              to="/pricing"
              onClick={() => setPracticeOpen(false)}
              className="flex items-center gap-3 rounded-2xl p-3 text-sm font-semibold text-muted-foreground hover:bg-accent"
            >
              <CreditCard className="size-4" /> Tariflar
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
