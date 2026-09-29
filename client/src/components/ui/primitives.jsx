import React, { useEffect, useRef } from 'react';
import { motion, useInView, useMotionValue, useSpring, useTransform } from 'motion/react';
import { cn } from '@/lib/utils';

/*
 * Ilova bo'ylab takrorlanadigan kichik qurilish bloklari.
 * Ilgari har sahifa o'z sarlavhasini, bo'sh holatini va yuklanish holatini
 * noldan chizardi — shuning uchun ular bir-biriga o'xshamasdi.
 */

// ─── Rang tonlari (Tailwind klasslari statik bo'lishi shart) ───────────────
const TONES = {
  primary: { bg: 'bg-primary/12', text: 'text-primary', ring: 'ring-primary/20', solid: 'bg-primary' },
  success: { bg: 'bg-success/12', text: 'text-success', ring: 'ring-success/20', solid: 'bg-success' },
  warning: { bg: 'bg-warning/15', text: 'text-[color-mix(in_oklch,var(--warning)_70%,var(--foreground))]', ring: 'ring-warning/25', solid: 'bg-warning' },
  info: { bg: 'bg-info/12', text: 'text-info', ring: 'ring-info/20', solid: 'bg-info' },
  streak: { bg: 'bg-streak/12', text: 'text-streak', ring: 'ring-streak/20', solid: 'bg-streak' },
  xp: { bg: 'bg-xp/15', text: 'text-[color-mix(in_oklch,var(--xp)_65%,var(--foreground))]', ring: 'ring-xp/25', solid: 'bg-xp' },
  pink: { bg: 'bg-pink-500/12', text: 'text-pink-600 dark:text-pink-400', ring: 'ring-pink-500/20', solid: 'bg-pink-500' },
  teal: { bg: 'bg-teal-500/12', text: 'text-teal-600 dark:text-teal-400', ring: 'ring-teal-500/20', solid: 'bg-teal-500' },
  muted: { bg: 'bg-muted', text: 'text-muted-foreground', ring: 'ring-border', solid: 'bg-muted-foreground' },
};

/** Rangli fonli ikonka qutisi */
export const IconTile = ({ icon: Icon, tone = 'primary', size = 'md', className }) => {
  const t = TONES[tone] || TONES.primary;
  const sizes = {
    sm: 'size-8 rounded-lg [&_svg]:size-4',
    md: 'size-11 rounded-xl [&_svg]:size-5',
    lg: 'size-14 rounded-2xl [&_svg]:size-7',
  };
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center', sizes[size], t.bg, t.text, className)}>
      <Icon aria-hidden="true" />
    </span>
  );
};

// ─── Harakat ──────────────────────────────────────────────────────────────
const EASE = [0.16, 1, 0.3, 1];

export const FadeIn = ({ as = 'div', delay = 0, y = 12, className, children, ...props }) => {
  const Comp = motion[as] || motion.div;
  return (
    <Comp
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className={className}
      {...props}
    >
      {children}
    </Comp>
  );
};

/** Bolalarini ketma-ket paydo qiladi */
export const Stagger = ({ as = 'div', className, children, delay = 0, gap = 0.06, ...props }) => {
  const Comp = motion[as] || motion.div;
  return (
    <Comp
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }}
      className={className}
      {...props}
    >
      {children}
    </Comp>
  );
};

export const StaggerItem = ({ as = 'div', className, children, ...props }) => {
  const Comp = motion[as] || motion.div;
  return (
    <Comp
      variants={{
        hidden: { opacity: 0, y: 14, scale: 0.98 },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: EASE } },
      }}
      className={className}
      {...props}
    >
      {children}
    </Comp>
  );
};

/** Raqamni ko'rinishga kirganda 0 dan sanab chiqaradi */
export const AnimatedNumber = ({ value = 0, className }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 20 });
  const rounded = useTransform(spring, (v) => Math.round(v).toLocaleString('uz-UZ'));

  useEffect(() => {
    if (inView) mv.set(Number(value) || 0);
  }, [inView, value, mv]);

  return <motion.span ref={ref} className={cn('tabular', className)}>{rounded}</motion.span>;
};

// ─── Sahifa sarlavhasi ───────────────────────────────────────────────────
export const PageHeader = ({ eyebrow, title, description, icon, tone = 'primary', actions, className }) => (
  <FadeIn className={cn('mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between', className)}>
    <div className="flex min-w-0 items-start gap-4">
      {icon && <IconTile icon={icon} tone={tone} size="lg" className="hidden sm:inline-flex" />}
      <div className="min-w-0">
        {eyebrow && (
          <p className={cn('mb-1 text-xs font-bold uppercase tracking-[0.12em]', (TONES[tone] || TONES.primary).text)}>
            {eyebrow}
          </p>
        )}
        <h1 className="text-[1.75rem] font-extrabold leading-[1.1] sm:text-4xl">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </FadeIn>
);

// ─── Bo'sh holat ─────────────────────────────────────────────────────────
export const EmptyState = ({ icon, tone = 'primary', title, description, children, className }) => (
  <FadeIn
    className={cn(
      'flex flex-col items-center rounded-3xl border border-dashed border-border bg-card/60 px-6 py-12 text-center sm:py-16',
      className
    )}
  >
    {icon && (
      <div className="relative mb-5">
        <div className={cn('absolute inset-0 -z-10 scale-150 rounded-full blur-2xl', (TONES[tone] || TONES.primary).bg)} />
        <IconTile icon={icon} tone={tone} size="lg" className="animate-float" />
      </div>
    )}
    <h3 className="text-lg font-extrabold">{title}</h3>
    {description && <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>}
    {children && <div className="mt-6 flex flex-col gap-2 sm:flex-row">{children}</div>}
  </FadeIn>
);

// ─── Skeleton ────────────────────────────────────────────────────────────
export const Skeleton = ({ className }) => <div className={cn('skeleton', className)} aria-hidden="true" />;

export const PageSkeleton = ({ cards = 3 }) => (
  <div className="space-y-6" aria-busy="true" aria-label="Yuklanmoqda">
    <div className="space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-64 max-w-full" />
      <Skeleton className="h-4 w-96 max-w-full" />
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: cards }).map((_, i) => (
        <Skeleton key={i} className="h-40 rounded-2xl" />
      ))}
    </div>
  </div>
);

// ─── Progress ────────────────────────────────────────────────────────────
export const ProgressBar = ({ value = 0, max = 100, tone = 'primary', className, barClassName, label }) => {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
    >
      <motion.div
        className={cn('h-full rounded-full', (TONES[tone] || TONES.primary).solid, barClassName)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: EASE }}
      />
    </div>
  );
};

export const ProgressRing = ({ value = 0, max = 100, size = 120, stroke = 10, className, trackClassName, children, gradientId = 'ring-grad' }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / (max || 1)));
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.88 0.1 300)" />
            <stop offset="100%" stopColor="white" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={cn('stroke-white/20', trackClassName)} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={`url(#${gradientId})`}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1.1, ease: EASE, delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
};

// ─── Statistika plitkasi ─────────────────────────────────────────────────
export const StatTile = ({ icon, tone = 'primary', value, label, hint, className, children }) => (
  <div className={cn('surface flex items-center gap-3 p-4', className)} title={hint}>
    <IconTile icon={icon} tone={tone} />
    <div className="min-w-0">
      <div className="text-xl font-extrabold leading-none tabular">
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      <div className="mt-1 line-clamp-2 text-xs font-medium leading-snug text-muted-foreground">{label}</div>
      {children}
    </div>
  </div>
);

// ─── Segment (filtr chiplari) ────────────────────────────────────────────
/** Tanlangan element ostidagi "pill" bir joydan ikkinchisiga suzib o'tadi */
export const Segmented = ({ options, value, onChange, className, layoutId = 'segmented-pill', ariaLabel }) => (
  <div
    role="tablist"
    aria-label={ariaLabel}
    className={cn('no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1 pb-1', className)}
  >
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onChange(opt.value)}
          className={cn(
            'relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors',
            active ? 'text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          {active && (
            <motion.span
              layoutId={layoutId}
              className="absolute inset-0 -z-0 rounded-full bg-primary shadow-sm"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          <span className="relative z-10 flex items-center gap-1.5">
            {opt.icon && <opt.icon className="size-4" />}
            {opt.label}
            {opt.count != null && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] tabular',
                  active ? 'bg-white/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                {opt.count}
              </span>
            )}
          </span>
        </button>
      );
    })}
  </div>
);

/** Kichik ishora: "yangi" nuqta, yoki bajarilgan belgisi va h.k. */
export const Kbd = ({ children }) => (
  <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[11px] font-semibold text-muted-foreground">
    {children}
  </kbd>
);
