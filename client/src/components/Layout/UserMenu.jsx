import React from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun, Monitor, BarChart3, CreditCard, ChevronsUpDown, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';
import { performLogout } from '../../utils/authHelpers';

export const Avatar = ({ name, className }) => {
  const initials = String(name || 'U')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <span
      className={cn(
        'brand-gradient inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white ring-2 ring-background',
        className
      )}
      aria-hidden="true"
    >
      {initials || 'U'}
    </span>
  );
};

const THEMES = [
  { value: 'light', label: "Yorug'", icon: Sun },
  { value: 'dark', label: "Qorong'i", icon: Moon },
  { value: 'system', label: 'Tizim', icon: Monitor },
];

/**
 * Hisob menyusi. `variant="sidebar"` — desktop sidebar pastidagi to'liq karta,
 * `variant="avatar"` — mobil top bar'dagi dumaloq tugma.
 */
const UserMenu = ({ user, variant = 'sidebar', align = 'end', side = 'bottom' }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === 'avatar' ? (
          <button
            type="button"
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Hisob menyusi"
          >
            <Avatar name={user?.name} />
          </button>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent"
          >
            <Avatar name={user?.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{user?.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} side={side} className="w-64">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-bold">{user?.name}</p>
          <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => navigate('/analytics')}>
          <BarChart3 /> Natijalar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/pricing')}>
          <CreditCard /> Tariflar
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          <Settings /> Sozlamalar
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        <div className="px-3 pb-1 pt-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Mavzu
        </div>
        <div className="grid grid-cols-3 gap-1 p-1" role="radiogroup" aria-label="Mavzu">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={theme === t.value}
              onClick={() => setTheme(t.value)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold transition-colors',
                theme === t.value
                  ? 'bg-primary/12 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <t.icon className="size-4" />
              {t.label}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem destructive onSelect={() => performLogout(dispatch)}>
          <LogOut /> Chiqish
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
