import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { toast } from 'react-hot-toast';
import {
  useGetSubscriptionQuery,
  useCreateCheckoutSessionMutation,
  useCreatePortalSessionMutation,
} from '../features/api/apiSlice';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader, PageSkeleton, IconTile } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';
import { Check, Loader2, Zap, Sprout, CreditCard, Info } from 'lucide-react';
import { track, EVENTS } from '../lib/analytics';

/**
 * Faqat HAQIQATAN mavjud imkoniyatlar yoziladi. Ilgari bu yerda olib
 * tashlangan "roleplay" va "3 qadamli reja" va'da qilinardi.
 * AI limitlari server `PLAN_LIMITS` (middleware/usageQuota.js) bilan bir xil.
 */
const PLANS = [
  {
    id: 'free',
    name: 'Bepul',
    price: '0',
    icon: Sprout,
    tone: 'success',
    tagline: 'Boshlash uchun hamma narsa',
    features: [
      'Kunlik sahna, takrorlash va tinglash',
      'Kuniga 15 ta AI tekshiruv',
      'Limit tugasa ham takrorlash to\'xtamaydi',
      'Dialogni takrorlash va yoddan aytish',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    icon: Zap,
    tone: 'primary',
    tagline: 'Har kuni jiddiy shug\'ullanadiganlar uchun',
    highlight: true,
    features: [
      'Kuniga 200 ta AI tekshiruv',
      "Takrorlashda AI grammatika tekshiruvi kun bo'yi",
      'Gap tahlili uchun katta limit',
      'Bepul tarifdagi hamma narsa',
    ],
  },
];

/** Ikki tarif: Bepul va Pro. Eski Premium obunachilar Pro kartasida ko'rinadi. */
const displayPlan = (plan) => (plan === 'premium' ? 'pro' : plan || 'free');

const Pricing = () => {
  const [params] = useSearchParams();
  const { data: sub, isLoading } = useGetSubscriptionQuery();
  const [checkout, { isLoading: checkingOut, originalArgs: checkoutPlan }] = useCreateCheckoutSessionMutation();
  const [portal, { isLoading: openingPortal }] = useCreatePortalSessionMutation();

  useEffect(() => {
    if (params.get('success')) toast.success("To'lov muvaffaqiyatli! Tarif faollashdi.");
    if (params.get('canceled')) toast("To'lov bekor qilindi.", { icon: 'ℹ️' });
  }, [params]);

  const currentPlan = displayPlan(sub?.plan);
  const currentPlanName = sub?.plan === 'premium' ? 'Premium' : PLANS.find((p) => p.id === currentPlan)?.name;
  const used = sub?.usage?.aiCallsToday;

  const handleUpgrade = async (plan) => {
    track(EVENTS.UPGRADE_CLICKED, { plan, currentPlan });
    try {
      const res = await checkout(plan).unwrap();
      if (res.url) window.location.href = res.url;
    } catch (err) {
      toast.error(err?.data?.message || "To'lov tizimi hozir mavjud emas. Keyinroq urining.");
    }
  };

  const handlePortal = async () => {
    try {
      const res = await portal().unwrap();
      if (res.url) window.location.href = res.url;
    } catch (err) {
      toast.error(err?.data?.message || 'Obunani boshqarish sahifasi hozir mavjud emas.');
    }
  };

  if (isLoading) return <PageSkeleton cards={2} />;

  return (
    <div>
      <PageHeader
        eyebrow="Tariflar"
        title="O'zingizga mos tarifni tanlang"
        icon={CreditCard}
        description={
          used != null
            ? `Joriy tarif: ${currentPlanName} · bugun ${used} ta AI tekshiruv ishlatildi`
            : undefined
        }
        actions={
          currentPlan !== 'free' && (
            <Button variant="outline" onClick={handlePortal} disabled={openingPortal}>
              {openingPortal && <Loader2 className="animate-spin" />}
              Obunani boshqarish
            </Button>
          )
        }
      />

      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-4 md:grid-cols-2 md:items-stretch">
        {PLANS.map((plan, i) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <motion.article
              key={plan.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'relative flex flex-col rounded-3xl border p-6',
                plan.highlight
                  ? 'border-primary/50 bg-card shadow-[0_24px_60px_-28px_color-mix(in_oklch,var(--primary)_70%,transparent)] ring-4 ring-primary/10 md:-translate-y-2'
                  : 'surface'
              )}
            >
              {plan.highlight && (
                <Badge variant="default" className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 shadow-md">
                  Tavsiya etiladi
                </Badge>
              )}
              <div className="flex items-center gap-3">
                <IconTile icon={plan.icon} tone={plan.tone} />
                <div>
                  <h2 className="text-lg font-extrabold">{plan.name}</h2>
                  <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                </div>
              </div>
              <p className="mt-6 text-4xl font-extrabold tracking-tight">
                {plan.price === '0' ? '$0' : plan.price}
                {plan.price !== '0' && <span className="text-base font-semibold text-muted-foreground"> /oy</span>}
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                      <Check className="size-3" strokeWidth={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                {isCurrent ? (
                  <Button disabled variant="secondary" size="lg" className="w-full">Joriy tarif</Button>
                ) : plan.id === 'free' ? (
                  <Button disabled variant="ghost" size="lg" className="w-full">Har doim bepul</Button>
                ) : (
                  <Button
                    size="lg"
                    variant={plan.highlight ? 'brand' : 'default'}
                    className="w-full"
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={checkingOut}
                  >
                    {checkingOut && checkoutPlan === plan.id ? <Loader2 className="animate-spin" /> : `${plan.name} ga o'tish`}
                  </Button>
                )}
              </div>
            </motion.article>
          );
        })}
      </div>

      <p className="mx-auto mt-8 flex max-w-xl items-start justify-center gap-2 text-center text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Hozircha faqat xalqaro kartalar (Stripe) qabul qilinadi. Uzcard/Humo uchun Payme va Click tez orada.
      </p>
    </div>
  );
};

export default Pricing;
