import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-hot-toast';
import {
  Settings as SettingsIcon, User, GraduationCap, Palette, Bell, ShieldCheck, LogOut, Trash2, Loader2,
  Sun, Moon, Monitor, Check, Lock, Sprout, MessageCircle, Rocket, Mic, BookOpen, Compass, Timer, CalendarDays, Trophy,
} from 'lucide-react';
import {
  useGetMeQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useDeleteAccountMutation,
} from '../features/api/apiSlice';
import { setCredentials } from '../features/auth/authSlice';
import { performLogout, clearLocalSession } from '../utils/authHelpers';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconTile, PageHeader, PageSkeleton } from '@/components/ui/primitives';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import NotificationSettings from '../components/NotificationSettings';
import { Avatar } from '../components/Layout/UserMenu';
import { Field, PasswordField } from '../components/Auth/Field';

const LEVELS = [
  { id: 'beginner', title: "Boshlang'ich", tag: 'A1–A2', icon: Sprout },
  { id: 'intermediate', title: "O'rta", tag: 'B1', icon: MessageCircle },
  { id: 'advanced', title: 'Yuqori', tag: 'B2+', icon: Rocket },
];
const GOALS = [
  { id: 'speaking', title: "So'zlashuv", icon: Mic },
  { id: 'vocabulary', title: "So'z boyligi", icon: BookOpen },
  { id: 'general', title: 'Umumiy', icon: Compass },
];
const PLANS = [
  { id: 'sprint', title: 'Sprint', tag: '~15 daq', icon: Timer },
  { id: 'foundation', title: 'Poydevor', tag: '~20 daq', icon: CalendarDays },
  { id: 'fluency', title: 'Erkinlik', tag: '~30 daq', icon: Trophy },
];
const THEMES = [
  { id: 'light', title: "Yorug'", icon: Sun },
  { id: 'dark', title: "Qorong'i", icon: Moon },
  { id: 'system', title: 'Tizim', icon: Monitor },
];

const Section = ({ icon, tone = 'primary', title, description, children, className }) => (
  <section className={cn('surface p-5 sm:p-6', className)}>
    <div className="mb-5 flex items-start gap-3">
      <IconTile icon={icon} tone={tone} />
      <div className="min-w-0">
        <h2 className="text-lg font-extrabold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
    </div>
    {children}
  </section>
);

/** Bir nechta variantdan birini tanlash (radio guruh) */
const OptionGroup = ({ label, options, value, onChange, disabled }) => (
  <div>
    <p className="mb-2 text-sm font-semibold">{label}</p>
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => !active && onChange(o.id)}
            className={cn(
              'relative flex flex-col items-center gap-1.5 rounded-2xl border-2 px-2 py-3 text-center transition-[border-color,background-color] active:scale-[0.98] disabled:opacity-60',
              active ? 'border-primary bg-primary/6' : 'border-border bg-card hover:border-primary/35'
            )}
          >
            {active && (
              <span className="absolute right-1.5 top-1.5 inline-flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-2.5" strokeWidth={3.5} />
              </span>
            )}
            <o.icon className={cn('size-5', active ? 'text-primary' : 'text-muted-foreground')} />
            <span className="text-sm font-bold leading-tight">{o.title}</span>
            {o.tag && <span className="text-[11px] font-medium text-muted-foreground">{o.tag}</span>}
          </button>
        );
      })}
    </div>
  </div>
);

const ProfileSection = ({ user }) => {
  const [name, setName] = useState(user?.name || '');
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();
  const dirty = name.trim() && name.trim() !== user?.name;

  const save = async (e) => {
    e.preventDefault();
    try {
      await updateProfile({ name: name.trim() }).unwrap();
      toast.success('Ism saqlandi');
    } catch (err) {
      toast.error(err?.data?.message === 'Validation failed' ? "Ism 2–80 belgidan iborat bo'lsin" : 'Saqlab bo\'lmadi');
    }
  };

  return (
    <Section icon={User} title="Profil" description="Ilovada shu ism bilan murojaat qilamiz.">
      <div className="mb-5 flex items-center gap-3">
        <Avatar name={name || user?.name} className="size-14 text-lg" />
        <div className="min-w-0">
          <p className="truncate font-bold">{user?.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>
      <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field
          label="Ism"
          icon={User}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoComplete="given-name"
          className="flex-1"
        />
        <Button type="submit" size="lg" disabled={!dirty || isLoading} className="sm:w-auto">
          {isLoading ? <Loader2 className="animate-spin" /> : 'Saqlash'}
        </Button>
      </form>
    </Section>
  );
};

const LearningSection = ({ user }) => {
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();
  const ob = user?.onboarding || {};

  const save = async (patch, label) => {
    try {
      await updateProfile(patch).unwrap();
      toast.success(`${label} yangilandi`);
    } catch {
      toast.error("Saqlab bo'lmadi. Qayta urining.");
    }
  };

  return (
    <Section
      icon={GraduationCap}
      tone="info"
      title="O'quv sozlamalari"
      description="Daraja kunlik yangi so'zlar sonini va izohlar murakkabligini belgilaydi. Kurs qaytadan boshlanmaydi."
    >
      <div className="space-y-5">
        <OptionGroup label="Daraja" options={LEVELS} value={ob.level} disabled={isLoading} onChange={(v) => save({ level: v }, 'Daraja')} />
        <OptionGroup label="Maqsad" options={GOALS} value={ob.goal} disabled={isLoading} onChange={(v) => save({ goal: v }, 'Maqsad')} />
        <OptionGroup label="Kunlik vaqt" options={PLANS} value={ob.planType} disabled={isLoading} onChange={(v) => save({ planType: v }, 'Reja')} />
      </div>
    </Section>
  );
};

const AppearanceSection = () => {
  const { theme, setTheme } = useTheme();
  return (
    <Section icon={Palette} tone="pink" title="Ko'rinish" description="“Tizim” — telefon yoki kompyuter sozlamasiga ergashadi.">
      <OptionGroup label="Mavzu" options={THEMES} value={theme} onChange={setTheme} />
    </Section>
  );
};

const SecuritySection = () => {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const submit = async (e) => {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("Yangi parol kamida 8 ta belgidan iborat bo'lsin");
      return;
    }
    try {
      const res = await changePassword({ currentPassword: current, newPassword: next }).unwrap();
      // Joriy qurilma yangi token bilan qoladi — boshqa qurilmalar chiqarildi
      dispatch(setCredentials({ user, token: res.token }));
      setCurrent('');
      setNext('');
      toast.success(res.message || "Parol o'zgartirildi");
    } catch (err) {
      toast.error(err?.data?.message || "Parolni o'zgartirib bo'lmadi");
    }
  };

  return (
    <Section icon={ShieldCheck} tone="success" title="Xavfsizlik" description="Parol o'zgargach, boshqa barcha qurilmalardan chiqiladi.">
      <form onSubmit={submit} className="space-y-4">
        <PasswordField label="Joriy parol" icon={Lock} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        <PasswordField
          label="Yangi parol"
          icon={Lock}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          hint="Kamida 8 ta belgi"
          required
        />
        <Button type="submit" size="lg" disabled={isLoading || !current || !next}>
          {isLoading ? <Loader2 className="animate-spin" /> : "Parolni o'zgartirish"}
        </Button>
      </form>
    </Section>
  );
};

const AccountSection = () => {
  const dispatch = useDispatch();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [deleteAccount, { isLoading }] = useDeleteAccountMutation();

  const confirmDelete = async (e) => {
    e.preventDefault();
    try {
      await deleteAccount(password).unwrap();
      setOpen(false);
      toast.success("Hisobingiz o'chirildi. Xayr!");
      await clearLocalSession(dispatch);
    } catch (err) {
      toast.error(err?.data?.message || "Hisobni o'chirib bo'lmadi");
    }
  };

  return (
    <Section icon={LogOut} tone="muted" title="Hisob" className="lg:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Shu qurilmadan chiqish. Progressingiz saqlanib qoladi.</p>
        <Button variant="outline" size="lg" onClick={() => performLogout(dispatch)}>
          <LogOut /> Chiqish
        </Button>
      </div>

      <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-bold text-destructive">Hisobni o&apos;chirish</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Lug&apos;at, progress va barcha ma&apos;lumotlar butunlay o&apos;chiriladi. Qaytarib bo&apos;lmaydi.
          </p>
        </div>
        <Button variant="destructive" size="lg" onClick={() => setOpen(true)} className="shrink-0">
          <Trash2 /> O&apos;chirish
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setPassword(''); }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={confirmDelete} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Hisob butunlay o&apos;chirilsinmi?</DialogTitle>
              <DialogDescription>
                Barcha so&apos;zlar, takrorlash tarixi, streak va sozlamalar o&apos;chiriladi. Tasdiqlash uchun parolingizni kiriting.
              </DialogDescription>
            </DialogHeader>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Parolingiz"
              autoComplete="current-password"
              aria-label="Parol"
              autoFocus
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isLoading}>
                Bekor qilish
              </Button>
              <Button type="submit" variant="destructive" disabled={!password || isLoading}>
                {isLoading && <Loader2 className="animate-spin" />}
                Ha, o&apos;chirish
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Section>
  );
};

const Settings = () => {
  const { data: user, isLoading } = useGetMeQuery();
  if (isLoading) return <PageSkeleton cards={4} />;

  return (
    <div>
      <PageHeader eyebrow="Sozlamalar" title="Hisob va sozlamalar" icon={SettingsIcon} description="Profil, o'quv rejasi, eslatmalar va xavfsizlik." />
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <ProfileSection key={user?.name} user={user} />
        <AppearanceSection />
        <LearningSection user={user} />
        <div className="space-y-5">
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-muted-foreground">
              <Bell className="size-4" /> Eslatmalar
            </p>
            <NotificationSettings />
          </div>
          <SecuritySection />
        </div>
        <AccountSection />
      </div>
    </div>
  );
};

export default Settings;
