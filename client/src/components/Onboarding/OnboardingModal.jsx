import React, { useState } from 'react';
import { useGetMeQuery, useOnboardUserMutation } from '../../features/api/apiSlice';
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight, Target, Brain, AlignLeft, Zap, Sparkles, BookOpen } from "lucide-react";
import { toast } from "react-hot-toast";

const OnboardingModal = () => {
    const { data: user, isLoading: isUserLoading, refetch } = useGetMeQuery();
    const [onboardUser, { isLoading: isSubmitting }] = useOnboardUserMutation();

    const [step, setStep] = useState(1);
    const [answers, setAnswers] = useState({
        level: '',
        goal: '',
        planType: ''
    });

    if (isUserLoading || !user) return null;

    // Only show if onboarding is not completed
    if (user.onboarding?.completed) return null;

    const handleNext = () => setStep(s => s + 1);

    const handleFinish = async () => {
        if (!answers.level || !answers.goal || !answers.planType) {
            toast.error("Iltimos, barcha savollarga javob bering");
            return;
        }

        try {
            await onboardUser(answers).unwrap();
            toast.success("Ajoyib! O'quv rejangiz tayyorlandi.", { icon: '🎯' });
            refetch(); // Refresh user data
        } catch (error) {
            toast.error("Xatolik yuz berdi. Qayta urinib ko'ring.");
            console.error(error);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-card w-full max-w-2xl text-card-foreground rounded-3xl shadow-2xl border border-border overflow-hidden relative">
                
                {/* Visual Header */}
                <div className="h-32 bg-gradient-to-br from-purple-600 to-pink-600 relative overflow-hidden flex items-center justify-center">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl mix-blend-overlay"></div>
                    <Sparkles className="w-12 h-12 text-white/50 absolute left-8 top-8" />
                    <h2 className="text-3xl font-black text-white relative z-10">Linguist AI</h2>
                </div>

                <div className="p-5 sm:p-8">
                    {step === 1 && (
                        <div className="animate-in slide-in-from-right-4">
                            <h3 className="text-2xl font-bold mb-2">Ingliz tili darajangiz qanday?</h3>
                            <p className="text-muted-foreground mb-6">Biz sizga mos so'zlar va mashqlarni tanlashimiz uchun bu muhim.</p>
                            
                            <div className="space-y-3">
                                {[
                                    { id: 'beginner', title: "Yangi boshlovchi (Beginner/A1)", icon: <Brain />, text: "Kop so'zlarni endi o'rganyapman." },
                                    { id: 'intermediate', title: "O'rta (Intermediate/B1)", icon: <AlignLeft />, text: "Fikrimni tushuntira olaman, lekin xatolar qilaman." },
                                    { id: 'advanced', title: "Yuqori (Advanced/C1)", icon: <Zap />, text: "Erkin gaplashaman, biroq xotirani boyitmoqchiman." }
                                ].map(opt => (
                                    <button 
                                        key={opt.id}
                                        onClick={() => { setAnswers({...answers, level: opt.id}); handleNext(); }}
                                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${answers.level === opt.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-muted/50'}`}
                                    >
                                        <div className={`p-3 rounded-xl ${answers.level === opt.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                            {opt.icon}
                                        </div>
                                        <div>
                                            <div className="font-bold text-lg">{opt.title}</div>
                                            <div className="text-sm text-muted-foreground">{opt.text}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-in slide-in-from-right-4">
                            <h3 className="text-2xl font-bold mb-2">Asosiy maqsadingiz nimada?</h3>
                            <p className="text-muted-foreground mb-6">Tizim sizning maqsadingizga qarab vazifalarni moslashtiradi.</p>
                            
                            <div className="space-y-3">
                                {[
                                    { id: 'speaking', title: "So'zlashuv va Talaffuz (Speaking)", text: "Erkin va to'g'ri gapirishni xohlayman." },
                                    { id: 'vocabulary', title: "So'z boyligini oshirish (Vocabulary)", text: "Ko'proq yangi so'zlarni yodlash." },
                                    { id: 'general', title: "Umumiy (General)", text: "Barcha ko'nikmalarni birgalikda o'stirish." }
                                ].map(opt => (
                                    <button 
                                        key={opt.id}
                                        onClick={() => { setAnswers({...answers, goal: opt.id}); handleNext(); }}
                                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${answers.goal === opt.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-muted/50'}`}
                                    >
                                        <Target className={`w-6 h-6 ${answers.goal === opt.id ? 'text-primary' : 'text-muted-foreground'}`}/>
                                        <div>
                                            <div className="font-bold text-lg">{opt.title}</div>
                                            <div className="text-sm text-muted-foreground">{opt.text}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                             <div className="mt-6 flex justify-start">
                                <Button variant="ghost" onClick={() => setStep(1)}>Orqaga</Button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-in slide-in-from-right-4">
                            <h3 className="text-2xl font-bold mb-2">O'quv rejasini tanlang</h3>
                            <p className="text-muted-foreground mb-6">Til o'rganishda intizom (discipline) eng muhimi. Qaysi reja sizga ko'proq mos?</p>
                            
                            <div className="space-y-3">
                                {[
                                    { id: 'sprint', title: "Sprint (1 Haftalik)", text: "Kuniga ~15 daqiqa. Odat shakllantirish uchun boshlang'ich qadam." },
                                    { id: 'foundation', title: "Foundation (1 Oylik)", text: "Kuniga ~20 daqiqa. Lug'at va so'zlashuv blokini buzish uchun." },
                                    { id: 'fluency', title: "Fluency (100 Kunlik 🔥)", text: "Kuniga ~30 daqiqa. To'liq erkinlikka chiqish uchun kuchli reja." }
                                ].map(opt => (
                                    <button 
                                        key={opt.id}
                                        onClick={() => setAnswers({...answers, planType: opt.id})}
                                        className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${answers.planType === opt.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-muted/50'}`}
                                    >
                                        <BookOpen className={`w-6 h-6 ${answers.planType === opt.id ? 'text-primary' : 'text-muted-foreground'}`}/>
                                        <div>
                                            <div className="font-bold text-lg">{opt.title}</div>
                                            <div className="text-sm text-muted-foreground">{opt.text}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="mt-8 flex justify-between items-center bg-muted/30 p-4 rounded-xl border border-border">
                                <p className="text-sm text-muted-foreground">Ma'lumotlar profilingizga saqlanadi va ularni keyinroq ham o'zgartirishingiz mumkin.</p>
                                <Button 
                                    onClick={handleFinish} 
                                    disabled={!answers.planType || isSubmitting}
                                    size="lg"
                                    className="rounded-full shadow-lg ml-4 shrink-0"
                                >
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Boshladik"} <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                            <div className="mt-4 flex justify-start">
                                <Button variant="ghost" onClick={() => setStep(2)}>Orqaga</Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-secondary absolute bottom-0 left-0">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }}></div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingModal;
