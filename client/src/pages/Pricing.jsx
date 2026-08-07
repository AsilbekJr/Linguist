import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  useGetSubscriptionQuery,
  useCreateCheckoutSessionMutation,
  useCreatePortalSessionMutation,
} from '../features/api/apiSlice';
import { Button } from '@/components/ui/button';
import { Check, Loader2, Crown, Zap } from 'lucide-react';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '0',
    features: ['15 AI chaqiruv/kun', 'Kunlik 3 qadam reja', '100 kun challenge'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    features: ['200 AI chaqiruv/kun', 'Cheksiz roleplay', 'Speaking Lab to\'liq'],
    highlight: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$19.99',
    features: ['Cheksiz AI', 'Maxsus ssenariylar', 'Analytics va ustuvor qo\'llab-quvvatlash'],
  },
];

const Pricing = () => {
  const [params] = useSearchParams();
  const { data: sub, isLoading } = useGetSubscriptionQuery();
  const [checkout, { isLoading: checkingOut }] = useCreateCheckoutSessionMutation();
  const [portal, { isLoading: openingPortal }] = useCreatePortalSessionMutation();

  useEffect(() => {
    if (params.get('success')) toast.success('To\'lov muvaffaqiyatli! Pro tarif faollashdi.');
    if (params.get('canceled')) toast('To\'lov bekor qilindi.', { icon: 'ℹ️' });
  }, [params]);

  const currentPlan = sub?.plan || 'free';

  const handleUpgrade = async (plan) => {
    try {
      const res = await checkout(plan).unwrap();
      if (res.url) window.location.href = res.url;
    } catch (err) {
      toast.error(err?.data?.message || 'Stripe sozlanmagan. .env da STRIPE kalitlarini tekshiring.');
    }
  };

  const handlePortal = async () => {
    try {
      const res = await portal().unwrap();
      if (res.url) window.location.href = res.url;
    } catch (err) {
      toast.error(err?.data?.message || 'Billing portal mavjud emas.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
      <div className="text-center">
        <h1 className="text-3xl md:text-5xl font-black mb-3">Tariflar</h1>
        <p className="text-muted-foreground">
          Hozirgi tarif: <span className="font-bold text-primary uppercase">{currentPlan}</span>
        </p>
        {currentPlan !== 'free' && (
          <Button variant="outline" className="mt-4 rounded-full" onClick={handlePortal} disabled={openingPortal}>
            Obunani boshqarish
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-3xl border p-6 flex flex-col ${
              plan.highlight ? 'border-primary shadow-lg shadow-primary/10 bg-primary/5' : 'border-border bg-card'
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              {plan.id === 'premium' ? <Crown className="w-6 h-6 text-yellow-500" /> : <Zap className="w-6 h-6 text-primary" />}
              <h2 className="text-xl font-black">{plan.name}</h2>
            </div>
            <p className="text-3xl font-black mb-6">
              {plan.price}
              {plan.id !== 'free' && <span className="text-sm font-normal text-muted-foreground">/oy</span>}
            </p>
            <ul className="space-y-2 mb-8 flex-grow">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            {plan.id === 'free' ? (
              <Button disabled variant="secondary" className="rounded-full">
                Joriy (bepul)
              </Button>
            ) : currentPlan === plan.id ? (
              <Button disabled className="rounded-full">
                Faol tarif
              </Button>
            ) : (
              <Button
                className="rounded-full font-bold"
                onClick={() => handleUpgrade(plan.id)}
                disabled={checkingOut}
              >
                {checkingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : `${plan.name} ga o'tish`}
              </Button>
            )}
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Hozircha faqat xalqaro to&apos;lov (Stripe). O&apos;zbekiston kartalari uchun Payme va Click
        integratsiyasi ishlanmoqda.
      </p>
    </div>
  );
};

export default Pricing;
