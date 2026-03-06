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
                            <h3 className="text-xl md:text-2xl font-black mb-2 text-foreground">Ingliz tili darajangiz qanday?</h3>
                            <p className="text-sm md:text-base text-muted-foreground mb-6">Biz sizga mos so'zlar va mashqlarni tanlashimiz uchun bu muhim.</p>
                            
                            <div className="space-y-3">
                                {[
                                    { id: 'beginner', title: "Yangi boshlovchi (A1)", icon: <Brain className="w-5 h-5 md:w-6 md:h-6" />, text: "Ko'p so'zlarni endi o'rganyapman." },
                                    { id: 'intermediate', title: "O'rta (B1)", icon: <AlignLeft className="w-5 h-5 md:w-6 md:h-6" />, text: "Fikrimni tushuntira olaman, xatolar bilan." },
                                    { id: 'advanced', title: "Yuqori (C1)", icon: <Zap className="w-5 h-5 md:w-6 md:h-6" />, text: "Erkin gaplashaman, xotirani boyitmoqchiman." }
                                ].map(opt => (
                                    <button 
                                        key={opt.id}
                                        onClick={() => { setAnswers({...answers, level: opt.id}); handleNext(); }}
                                        className={`w-full text-left p-3 md:p-4 rounded-2xl border-2 transition-all flex items-center gap-3 md:gap-4 ${answers.level === opt.id ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' : 'border-border hover:border-primary/30 hover:bg-muted/50'}`}
                                    >
                                        <div className={`p-2 md:p-3 rounded-xl shrink-0 ${answers.level === opt.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                            {opt.icon}
                                        </div>
                                        <div>
                                            <div className="font-bold text-base md:text-lg text-foreground">{opt.title}</div>
                                            <div className="text-xs md:text-sm text-muted-foreground mt-0.5">{opt.text}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-in slide-in-from-right-4">
                            <h3 className="text-xl md:text-2xl font-black mb-2 text-foreground">Asosiy maqsadingiz nimada?</h3>
                            <p className="text-sm md:text-base text-muted-foreground mb-6">Tizim sizning maqsadingizga qarab vazifalarni moslashtiradi.</p>
                            
                            <div className="space-y-3">
                                {[
                                    { id: 'speaking', title: "So'zlashuv (Speaking)", text: "Talaffuz va erkinlik." },
                                    { id: 'vocabulary', title: "So'z boyligi (Vocabulary)", text: "Yangi so'zlarni yodlash." },
                                    { id: 'general', title: "Umumiy (General)", text: "Barcha ko'nikmalarni o'stirish." }
                                ].map(opt => (
                                    <button 
                                        key={opt.id}
                                        onClick={() => { setAnswers({...answers, goal: opt.id}); handleNext(); }}
                                        className={`w-full text-left p-3 md:p-4 rounded-2xl border-2 transition-all flex items-center gap-3 md:gap-4 ${answers.goal === opt.id ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' : 'border-border hover:border-primary/30 hover:bg-muted/50'}`}
                                    >
                                        <div className={`p-2 md:p-3 rounded-xl shrink-0 ${answers.goal === opt.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                            <Target className="w-5 h-5 md:w-6 md:h-6" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-base md:text-lg text-foreground">{opt.title}</div>
                                            <div className="text-xs md:text-sm text-muted-foreground mt-0.5">{opt.text}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                             <div className="mt-6 flex justify-start">
                                <Button variant="ghost" className="rounded-full px-6" onClick={() => setStep(1)}>Orqaga</Button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-in slide-in-from-right-4">
                            <h3 className="text-xl md:text-2xl font-black mb-2 text-foreground">O'quv rejasini tanlang</h3>
                            <p className="text-sm md:text-base text-muted-foreground mb-6">Til o'rganishda intizom eng muhimi. Qaysi reja sizga mos?</p>
                            
                            <div className="space-y-3">
                                {[
                                    { id: 'sprint', title: "Sprint (1 Haftalik)", text: "~15 daqiqa/kun. Odat shakllantirish." },
                                    { id: 'foundation', title: "Foundation (1 Oylik)", text: "~20 daqiqa/kun. Erkinroq bo'lish." },
                                    { id: 'fluency', title: "Fluency (100 Kun 🚀)", text: "~30 daqiqa/kun. Kuchli natija!" }
                                ].map(opt => (
                                    <button 
                                        key={opt.id}
                                        onClick={() => setAnswers({...answers, planType: opt.id})}
                                        className={`w-full text-left p-3 md:p-4 rounded-2xl border-2 transition-all flex items-center gap-3 md:gap-4 ${answers.planType === opt.id ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' : 'border-border hover:border-primary/30 hover:bg-muted/50'}`}
                                    >
                                        <div className={`p-2 md:p-3 rounded-xl shrink-0 ${answers.planType === opt.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                                            <BookOpen className="w-5 h-5 md:w-6 md:h-6" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-base md:text-lg text-foreground">{opt.title}</div>
                                            <div className="text-xs md:text-sm text-muted-foreground mt-0.5">{opt.text}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="mt-6 md:mt-8 flex flex-col sm:flex-row justify-between items-center sm:items-end gap-4 p-4 rounded-2xl bg-secondary/30 border border-border">
                                <p className="text-xs md:text-sm text-center sm:text-left text-muted-foreground max-w-[280px]">
                                    Ma'lumotlar saqlanadi. Keyinroq profilingizdan o'zgartirishingiz mumkin.
                                </p>
                                <Button 
                                    onClick={handleFinish} 
                                    disabled={!answers.planType || isSubmitting}
                                    size="lg"
                                    className="w-full sm:w-auto rounded-full shadow-lg font-bold text-base"
                                >
                                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto text-white" /> : <span className="flex items-center text-white">Boshladik <ArrowRight className="w-5 h-5 ml-2 text-white" /></span>}
                                </Button>
                            </div>
                            <div className="mt-4 flex justify-center sm:justify-start">
                                <Button variant="ghost" className="rounded-full px-6" onClick={() => setStep(2)}>Orqaga</Button>
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
