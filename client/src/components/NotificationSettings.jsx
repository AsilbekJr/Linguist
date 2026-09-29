import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Bell, BellOff, Loader2, Smartphone, Send } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  useGetNotificationPrefsQuery,
  useUpdateNotificationPrefsMutation,
  useGetPushStatusQuery,
  useGetPushPublicKeyQuery,
  useSubscribePushMutation,
  useUnsubscribePushMutation,
  useSendTestPushMutation,
} from '../features/api/apiSlice';
import {
  isPushSupported,
  getPermission,
  subscribeToPush,
  unsubscribeFromPush,
} from '../lib/push';
import { Button } from '@/components/ui/button';
import { IconTile, Skeleton } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

const HOURS = [7, 9, 12, 15, 18, 19, 20, 21, 22];

/** Yoqish/o'chirish tugmasi */
const Switch = ({ checked, onChange, disabled, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className={cn(
      'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
      checked ? 'bg-primary' : 'bg-muted-foreground/25'
    )}
  >
    <motion.span
      layout
      transition={{ type: 'spring', stiffness: 600, damping: 32 }}
      className={cn('absolute size-5 rounded-full bg-white shadow-md', checked ? 'right-1' : 'left-1')}
    />
  </button>
);

/**
 * Push bildirishnoma.
 *
 * Ruxsat FAQAT foydalanuvchi tugmani bosgandan keyin so'raladi. Sahifa
 * yuklanishida avtomatik so'rash — "block" bosilishining eng keng tarqalgan
 * sababi va bir marta bloklangandan keyin qaytarish deyarli imkonsiz.
 */
const PushToggle = () => {
  const { data: pushStatus } = useGetPushStatusQuery();
  const { data: keyData } = useGetPushPublicKeyQuery();
  const [subscribePush] = useSubscribePushMutation();
  const [unsubscribePush] = useUnsubscribePushMutation();
  const [sendTest, { isLoading: isTesting }] = useSendTestPushMutation();
  const [busy, setBusy] = useState(false);
  const [permission, setPermission] = useState(getPermission());

  const supported = isPushSupported();
  const configured = keyData?.configured;
  const devices = pushStatus?.devices || 0;

  if (!supported || !configured) return null;

  const enable = async () => {
    setBusy(true);
    try {
      const result = await subscribeToPush(keyData.publicKey, (sub) =>
        subscribePush(sub).unwrap()
      );
      setPermission(getPermission());

      if (result === 'subscribed') {
        toast.success('Bildirishnomalar yoqildi');
      } else if (result === 'denied') {
        toast.error("Brauzer ruxsat bermadi. Sozlamalardan qo'lda yoqishingiz kerak.");
      } else {
        toast.error("Ulanmadi. Qayta urinib ko'ring.");
      }
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) await unsubscribePush(endpoint).unwrap();
      toast.success("Bildirishnomalar o'chirildi");
    } catch {
      toast.error("O'chirib bo'lmadi. Qayta urining.");
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    try {
      await sendTest().unwrap();
      toast.success('Sinov bildirishnomasi yuborildi');
    } catch (err) {
      toast.error(err?.data?.message || 'Yuborilmadi');
    }
  };

  return (
    <div className="border-t border-border pt-5">
      <div className="flex items-start gap-3">
        <IconTile icon={Smartphone} tone="info" size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Telefon bildirishnomasi</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {devices > 0
              ? `${devices} ta qurilma ulangan. Eslatma email o'rniga shu yerga keladi.`
              : "Email o'rniga telefoningizga darhol bildirishnoma keladi."}
          </p>
          {permission === 'denied' && (
            <p className="mt-2 text-xs font-medium text-warning">
              Brauzer bildirishnomalarni bloklagan. Sayt sozlamalaridan ruxsat bering.
            </p>
          )}
          {devices > 0 && (
            <Button variant="link" size="sm" className="mt-1 h-auto px-0" onClick={handleTest} disabled={isTesting}>
              <Send /> {isTesting ? 'Yuborilmoqda…' : 'Sinov bildirishnomasi'}
            </Button>
          )}
        </div>
        <Button
          size="sm"
          variant={devices > 0 ? 'outline' : 'default'}
          disabled={busy || permission === 'denied'}
          onClick={devices > 0 ? disable : enable}
        >
          {busy ? <Loader2 className="animate-spin" /> : devices > 0 ? "O'chirish" : 'Yoqish'}
        </Button>
      </div>
    </div>
  );
};

/**
 * Kunlik eslatma sozlamalari.
 *
 * Soat foydalanuvchining MAHALLIY vaqtida — server UTC'da ishlasa ham xat
 * odamning kechqurunida yetib boradi. Buni UI'da ochiq aytamiz, aks holda
 * "19:00 tanladim, lekin tushda keldi" degan tushunmovchilik chiqadi.
 */
const NotificationSettings = () => {
  const { data: prefs, isLoading } = useGetNotificationPrefsQuery();
  const [updatePrefs, { isLoading: isSaving }] = useUpdateNotificationPrefsMutation();

  const save = async (patch) => {
    try {
      await updatePrefs(patch).unwrap();
      toast.success('Saqlandi');
    } catch {
      toast.error('Saqlashda xatolik');
    }
  };

  if (isLoading) return <Skeleton className="h-44 rounded-2xl" />;

  const enabled = prefs?.enabled !== false;

  return (
    <section className="surface space-y-5 p-5 sm:p-6" aria-labelledby="reminder-title">
      <div className="flex items-start gap-3">
        <IconTile icon={enabled ? Bell : BellOff} tone={enabled ? 'primary' : 'muted'} />
        <div className="min-w-0 flex-1">
          <h2 id="reminder-title" className="font-bold">Kunlik eslatma</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Reja bajarilmagan kunlari eslatamiz. Reja tugagan kunlarda xabar kelmaydi.
          </p>
        </div>
        <Switch checked={enabled} disabled={isSaving} onChange={() => save({ enabled: !enabled })} label="Kunlik eslatma" />
      </div>

      {enabled && <PushToggle />}

      {enabled && (
        <div className="border-t border-border pt-5">
          <p className="mb-3 text-sm font-bold">Qaysi soatda?</p>
          <div className="flex flex-wrap gap-2">
            {HOURS.map((h) => (
              <button
                key={h}
                type="button"
                disabled={isSaving}
                onClick={() => save({ hour: h })}
                aria-pressed={prefs?.hour === h}
                className={cn(
                  'h-10 rounded-xl border px-3.5 text-sm font-bold tabular transition-colors disabled:opacity-60',
                  prefs?.hour === h
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card hover:border-primary/50'
                )}
              >
                {String(h).padStart(2, '0')}:00
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Mahalliy vaqtingiz bo&apos;yicha{prefs?.timezone ? ` (${prefs.timezone})` : ''}.
          </p>
        </div>
      )}
    </section>
  );
};

export default NotificationSettings;
