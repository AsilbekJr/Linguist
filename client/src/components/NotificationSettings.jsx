import React from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  useGetNotificationPrefsQuery,
  useUpdateNotificationPrefsMutation,
} from '../features/api/apiSlice';

const HOURS = [7, 9, 12, 15, 18, 19, 20, 21, 22];

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

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const enabled = prefs?.enabled !== false;

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          {enabled ? (
            <Bell className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          ) : (
            <BellOff className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <h2 className="font-bold">Kunlik eslatma</h2>
            <p className="text-sm text-muted-foreground">
              Kunlik reja bajarilmagan bo&apos;lsa, emailga eslatma yuboramiz.
              Reja tugagan kunlarda xat kelmaydi.
            </p>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={isSaving}
          onClick={() => save({ enabled: !enabled })}
          className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
            enabled ? 'bg-primary' : 'bg-secondary border border-border'
          } disabled:opacity-60`}
        >
          <span
            className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="pt-4 border-t border-border">
          <p className="text-sm font-bold mb-3">Qaysi soatda?</p>
          <div className="flex flex-wrap gap-2">
            {HOURS.map((h) => (
              <button
                key={h}
                type="button"
                disabled={isSaving}
                onClick={() => save({ hour: h })}
                className={`px-3 py-2 rounded-xl border text-sm font-bold transition-colors ${
                  prefs?.hour === h
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/50'
                } disabled:opacity-60`}
              >
                {String(h).padStart(2, '0')}:00
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Sizning mahalliy vaqtingiz bo&apos;yicha
            {prefs?.timezone ? ` (${prefs.timezone})` : ''}.
          </p>
        </div>
      )}
    </div>
  );
};

export default NotificationSettings;
