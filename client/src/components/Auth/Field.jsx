import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * Yorliqli maydon. Ilgari maydonlarda faqat placeholder bor edi — yozishni
 * boshlagan zahoti u yo'qolib, maydon nima uchunligi ko'rinmay qolardi,
 * ekran o'quvchilar esa uni umuman nomlay olmasdi.
 */
export const Field = ({ label, icon: Icon, hint, error, className, inputClassName, ...props }) => {
  const id = useId();
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={cn(Icon && 'pl-11', inputClassName)}
          {...props}
        />
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
};

export const PasswordField = ({ label = 'Parol', icon: Icon, hint, className, ...props }) => {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          className={cn('pr-12', Icon && 'pl-11')}
          aria-describedby={hint ? `${id}-hint` : undefined}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label={visible ? 'Parolni yashirish' : "Parolni ko'rsatish"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
};

/** Xato yoki ogohlantirish qutisi */
export const FormAlert = ({ tone = 'error', children }) => (
  <div
    role="alert"
    className={cn(
      'animate-fade-in rounded-2xl border px-4 py-3 text-sm font-medium',
      tone === 'error' && 'border-destructive/30 bg-destructive/8 text-destructive',
      tone === 'warning' && 'border-warning/35 bg-warning/10 text-foreground'
    )}
  >
    {children}
  </div>
);

export const AuthHeading = ({ title, subtitle }) => (
  <div className="mb-7">
    <h1 className="text-[1.9rem] font-extrabold leading-tight">{title}</h1>
    {subtitle && <p className="mt-2 text-[15px] text-muted-foreground">{subtitle}</p>}
  </div>
);
