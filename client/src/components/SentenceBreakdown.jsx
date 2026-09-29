import React from 'react';
import { motion } from 'motion/react';
import { Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Gap tahlili natijasi: har bir so'z, uning turkumi va gap bo'lagi.
 *
 * Ikki joyda ishlatiladi — takrorlash oqimida (foydalanuvchi o'zi tuzgan gap)
 * va "Gap tahlili" sahifasida (istalgan gap). Shuning uchun bu komponent
 * ma'lumot olib kelmaydi: unga tayyor tahlil beriladi.
 */

/** Gap bo'laklari — ranglar semantik tokenlarga tayanmaydi, chunki bu yerda
 *  ma'no ranglar bilan KODLANGAN va u ikkala mavzuda ham bir xil o'qilishi kerak. */
const ROLE_STYLES = {
  ega: { chip: 'bg-blue-500/12 text-blue-700 dark:text-blue-300 border-blue-500/25', line: 'decoration-blue-500' },
  kesim: { chip: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25', line: 'decoration-emerald-500' },
  "to'ldiruvchi": { chip: 'bg-amber-500/14 text-amber-700 dark:text-amber-300 border-amber-500/30', line: 'decoration-amber-500' },
  aniqlovchi: { chip: 'bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/25', line: 'decoration-violet-500' },
  hol: { chip: 'bg-pink-500/12 text-pink-700 dark:text-pink-300 border-pink-500/25', line: 'decoration-pink-500' },
  yordamchi: { chip: 'bg-muted text-muted-foreground border-border', line: 'decoration-muted-foreground/40' },
};

const roleStyle = (role) => ROLE_STYLES[role] || ROLE_STYLES.yordamchi;

/** Izohda takrorlanmasligi uchun: faqat haqiqiy gap bo'laklari legendaga tushadi */
const LEGEND_ROLES = ['ega', 'kesim', "to'ldiruvchi", 'aniqlovchi', 'hol'];

const SentenceBreakdown = ({ analysis }) => {
  if (!analysis?.tokens?.length) return null;

  const usedRoles = new Set(analysis.tokens.map((t) => t.role));
  const legend = LEGEND_ROLES.filter((r) => usedRoles.has(r));

  return (
    <div className="space-y-5">
      {/* Gapning o'zi — har so'z o'z bo'lagi rangida tagiga chizilgan */}
      <div>
        <p className="text-xl font-bold leading-[2] sm:text-2xl">
          {analysis.tokens.map((t, i) => (
            <React.Fragment key={`${t.word}-${i}`}>
              <span className={cn('underline decoration-[3px] underline-offset-[6px]', roleStyle(t.role).line)}>{t.word}</span>{' '}
            </React.Fragment>
          ))}
        </p>
        {analysis.translationUz && <p className="mt-1 text-muted-foreground">{analysis.translationUz}</p>}
      </div>

      {legend.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {legend.map((role) => (
            <span key={role} className={cn('rounded-full border px-2.5 py-1 text-xs font-bold', roleStyle(role).chip)}>
              {role}
            </span>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {analysis.tokens.map((token, i) => (
          <motion.li
            key={`${token.word}-${i}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.03 * i, duration: 0.3 }}
            className="flex flex-col gap-1 rounded-2xl border border-border bg-background p-3 sm:flex-row sm:items-baseline sm:gap-4"
          >
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:w-56">
              <span className="text-base font-bold">{token.word}</span>
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', roleStyle(token.role).chip)}>
                {token.role}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{token.partOfSpeech}</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm">{token.meaningUz}</p>
              {token.noteUz && <p className="mt-0.5 text-xs text-muted-foreground">{token.noteUz}</p>}
            </div>
          </motion.li>
        ))}
      </ul>

      {(analysis.tenseUz || analysis.structureUz) && (
        <div className="space-y-1 rounded-2xl border border-info/25 bg-info/8 p-4">
          {analysis.tenseUz && (
            <p className="flex items-center gap-2 text-sm">
              <Clock3 className="size-4 text-info" />
              <span className="font-bold">Zamon:</span> {analysis.tenseUz}
            </p>
          )}
          {analysis.structureUz && <p className="text-sm">{analysis.structureUz}</p>}
        </div>
      )}
    </div>
  );
};

export default SentenceBreakdown;
