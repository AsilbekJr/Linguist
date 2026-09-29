import React, { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Brend belgisi: suhbat pufakchasi ichida "L" — til = muloqot.
 * SVG ichida, shuning uchun har qanday o'lchamda tiniq va tashqi faylsiz.
 */
export const LogoMark = ({ className, title = 'Linguist AI' }) => {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn('size-9 shrink-0', className)}
      role="img"
      aria-label={title}
    >
      <defs>
        <linearGradient id={`lg-${id}`} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="oklch(0.6 0.24 282)" />
          <stop offset="1" stopColor="oklch(0.56 0.25 318)" />
        </linearGradient>
        <linearGradient id={`sh-${id}`} x1="20" y1="0" x2="20" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="white" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="12" fill={`url(#lg-${id})`} />
      <rect width="40" height="40" rx="12" fill={`url(#sh-${id})`} />
      {/* Pufakcha */}
      <path
        d="M12.5 10.5h15a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H20l-5.2 4.1a.6.6 0 0 1-.97-.47V26.5H12.5a4 4 0 0 1-4-4v-8a4 4 0 0 1 4-4Z"
        fill="white"
      />
      {/* "L" */}
      <path
        d="M16.2 14.6v7.2h7.6"
        fill="none"
        stroke={`url(#lg-${id})`}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="25.4" cy="15.4" r="1.7" fill={`url(#lg-${id})`} />
    </svg>
  );
};

/** Belgi + nom */
export const Logo = ({ className, markClassName, compact = false }) => (
  <span className={cn('inline-flex items-center gap-2.5 select-none', className)}>
    <LogoMark className={markClassName} />
    {!compact && (
      <span className="flex items-baseline gap-1.5 leading-none">
        <span className="font-display text-[1.15rem] font-extrabold tracking-tight text-foreground">
          Linguist
        </span>
        <span className="rounded-md bg-primary/12 px-1.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-primary">
          AI
        </span>
      </span>
    )}
  </span>
);

export default Logo;
