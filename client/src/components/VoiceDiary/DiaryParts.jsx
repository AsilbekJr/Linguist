import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Check, Download, Loader2, Mic, RotateCcw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { useRecorder } from '../../hooks/useRecorder';
import { addEntry, notifyDiaryChanged } from '../../lib/voiceDiary';

const extFor = (mime = '') => (mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm');

/** Blob uchun audio — URL yaratiladi va komponent yo'qolganda bo'shatiladi */
export const EntryAudio = ({ entry, className }) => {
  const url = useMemo(() => (entry?.blob ? URL.createObjectURL(entry.blob) : null), [entry?.blob]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  if (!url) return null;
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <audio src={url} controls preload="metadata" className="h-10 w-full min-w-0" />
      <a
        href={url}
        download={`linguist-${entry.kind}-${entry.dayKey}.${extFor(entry.mimeType)}`}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
        aria-label="Yozuvni yuklab olish"
        title="Yuklab olish — brauzer ma'lumoti tozalansa ham saqlanib qoladi"
      >
        <Download className="size-4" />
      </a>
    </div>
  );
};

/**
 * Yozib olish kartasi: yozish → eshitib ko'rish → saqlash yoki qayta yozish.
 * Saqlangan yozuv faqat shu qurilmada qoladi.
 */
export const RecordCard = ({ kind, dayKey, maxSeconds, title, children, text = '', textUz = '', onSaved, compact = false }) => {
  const rec = useRecorder({ maxSeconds });
  const [saving, setSaving] = useState(false);

  if (!rec.supported) {
    return (
      <p className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Bu brauzer ovoz yozishni qo&apos;llamaydi — Chrome yoki Safari&apos;ning yangi versiyasidan foydalaning.
      </p>
    );
  }

  const save = async () => {
    if (!rec.result) return;
    setSaving(true);
    try {
      const entry = await addEntry({
        kind,
        dayKey,
        text,
        textUz,
        blob: rec.result.blob,
        mimeType: rec.result.mimeType,
        durationMs: rec.result.durationMs,
      });
      notifyDiaryChanged();
      rec.reset();
      toast.success('Ovoz kundaligiga saqlandi', { icon: '🎙️' });
      onSaved?.(entry);
    } catch {
      toast.error("Saqlab bo'lmadi — brauzer xotirasi to'lgan yoki yopiq bo'lishi mumkin.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={cn('space-y-3', !compact && 'surface p-5')}>
      {title && <h3 className="font-extrabold">{title}</h3>}
      {children}

      {rec.recording && (
        <div className="flex items-center gap-3">
          <span className="relative inline-flex size-3">
            <span className="absolute inset-0 animate-ping rounded-full bg-destructive/60" />
            <span className="relative size-3 rounded-full bg-destructive" />
          </span>
          <ProgressBar value={rec.elapsed} max={maxSeconds} className="h-1.5 flex-1" label="Yozish vaqti" />
          <span className="text-sm font-bold tabular">
            {rec.elapsed}s<span className="text-muted-foreground">/{maxSeconds}s</span>
          </span>
        </div>
      )}

      {rec.result && !rec.recording && (
        <div className="rounded-2xl border border-border bg-muted/30 p-2">
          <audio src={rec.result.url} controls className="h-10 w-full" />
        </div>
      )}

      {rec.error && <p className="text-sm text-destructive">{rec.error}</p>}

      <div className="flex flex-wrap gap-2">
        {rec.recording ? (
          <Button variant="destructive" onClick={rec.stop}>
            <Square /> To&apos;xtatish
          </Button>
        ) : rec.result ? (
          <>
            <Button variant="success" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : <Check />} Saqlash
            </Button>
            <Button variant="outline" onClick={rec.start}>
              <RotateCcw /> Qayta yozish
            </Button>
          </>
        ) : (
          <Button variant="brand" onClick={rec.start}>
            <Mic /> Yozishni boshlash
          </Button>
        )}
      </div>
    </div>
  );
};
