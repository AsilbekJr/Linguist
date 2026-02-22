import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useGetWordsQuery, useCheckReviewMutation } from '../features/api/apiSlice';
import { groupWordsByReviewInterval } from '../utils/dateUtils';
import { BookOpen, ChevronLeft, Mic, MicOff } from 'lucide-react';

const ReviewMode = () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
    const { data: words = [], isLoading } = useGetWordsQuery();
    const [checkReviewMutation] = useCheckReviewMutation();

    const [selectedGroup, setSelectedGroup] = useState(null); // String: "Review Now ⚡", etc.
    const [sessionWords, setSessionWords] = useState([]); // Words ready for review in this session
    
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userSentence, setUserSentence] = useState('');
    const [feedback, setFeedback] = useState(null);
    const [checking, setChecking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState(null);
    const [error, setError] = useState(null);

    const userSentenceRef = useRef('');

    useEffect(() => {
        userSentenceRef.current = userSentence;
    }, [userSentence]);

    useEffect(() => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const rec = new SpeechRecognition();
            rec.continuous = false;
            rec.interimResults = true;
            rec.lang = 'en-US';

            rec.onresult = (event) => {
                let finalTrans = '';
                let interimTrans = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) finalTrans += event.results[i][0].transcript;
                    else interimTrans += event.results[i][0].transcript;
                }
                const newText = finalTrans || interimTrans;
                setUserSentence(newText);
            };

            rec.onend = () => {
                setIsListening(false);
            };

            rec.onerror = (e) => { 
                setIsListening(false); 
                console.error("Speech recognition error:", e);
                setError("Microphone error. Please try again or type.");
            };
            
            setRecognition(rec);
        }
    }, []);

    const toggleListening = () => {
        if (!recognition) {
            setError("Your browser doesn't support speech recognition.");
            return;
        }

        if (isListening) {
            recognition.stop();
        } else {
            setError(null);
            recognition.start();
            setIsListening(true);
        }
    };

    const groupedWords = useMemo(() => {
        return groupWordsByReviewInterval(words);
    }, [words]);

    const startReviewSession = (groupName, wordsInGroup) => {
        if (groupName === "Mastered 🏆") {
            alert("Siz bu so'zlarni to'liq o'zlashtirgansiz! Ular asosan arxivda saqlanadi.");
            return;
        }
        setSelectedGroup(groupName);
        setSessionWords(wordsInGroup);
        setCurrentIndex(0);
        setUserSentence('');
        setFeedback(null);
        setError(null);
    };

    const handleCheck = async () => {
        if (!userSentence.trim()) return;

        setChecking(true);
        const currentWord = sessionWords[currentIndex];

        try {
            const data = await checkReviewMutation({ id: currentWord._id, sentence: userSentence }).unwrap();
            setFeedback(data); // { isCorrect, feedback, nextReviewDate }
        } catch (err) {
            console.error("Check error:", err);
            setError("Tekshirishda xatolik yuz berdi. Iltimos qayta urinib ko'ring.");
        } finally {
            setChecking(false);
        }
    };

    const handleNext = () => {
        setFeedback(null);
        setUserSentence('');
        setError(null);
        if (isListening && recognition) recognition.stop();
        if (currentIndex < sessionWords.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            // Finished all reviews in this session
            setSessionWords([]); 
            setSelectedGroup(null);
        }
    };

    if (isLoading) return <div className="text-center py-20 animate-pulse">Yuklanmoqda...</div>;

    if (!selectedGroup) {
        // VIEW 1: Spaced Repetition Buckets / Cards
        const groupsEntries = Object.entries(groupedWords);

        if (groupsEntries.length === 0) {
            return (
                <div className="text-center py-20 bg-card border border-border border-dashed rounded-3xl max-w-2xl mx-auto">
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent mb-4">
                        Hammasi Bajarildi!
                    </h2>
                    <p className="text-muted-foreground text-lg mt-2">Hozircha takrorlash uchun so'zlar yo'q. Keyinroq qaytib ko'ring!</p>
                </div>
            );
        }

        return (
            <div className="max-w-4xl mx-auto animate-fade-in text-center">
                <div className="mb-12">
                   <h2 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent mb-4">
                      Takrorlash ✨
                   </h2>
                   <p className="text-muted-foreground text-lg">Xotirangizni mustahkamlash uchun guruhlardan birini tanlang.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                    {groupsEntries.map(([groupName, wordsInGroup]) => {
                        const isOverdue = groupName.includes("Overdue");
                        
                        return (
                            <div 
                                key={groupName} 
                                onClick={() => startReviewSession(groupName, wordsInGroup)}
                                className={`bg-card rounded-3xl p-6 border shadow-md transition-all cursor-pointer group ${
                                    isOverdue 
                                    ? 'border-destructive/50 hover:border-destructive shadow-destructive/10 hover:shadow-destructive/30 hover:-translate-y-1 animate-pulse hover:animate-none' 
                                    : 'border-border hover:shadow-xl hover:-translate-y-1 hover:border-pink-500/50'
                                }`}
                            >
                                <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${
                                    isOverdue
                                    ? 'bg-destructive/10 border-destructive/20 text-destructive'
                                    : 'bg-pink-500/10 border-pink-500/20 text-pink-500'
                                }`}>
                                    <BookOpen className="w-8 h-8" />
                                </div>
                                <h3 className="text-2xl font-bold text-card-foreground mb-2">
                                    {groupName}
                                </h3>
                                <p className="text-muted-foreground text-sm mb-4">
                                    {wordsInGroup.length} ta so'z
                                </p>
                                <div className={`flex items-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity ${
                                    isOverdue ? 'text-destructive' : 'text-pink-500'
                                }`}>
                                    Boshlash &rarr;
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // VIEW 2: Active Review Session
    const word = sessionWords[currentIndex];

    // If session is done
    if (!word) {
        return (
            <div className="text-center py-20 max-w-2xl mx-auto">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent mb-4">
                    Guruh Tugallandi!
                </h2>
                <p className="text-muted-foreground">Ajoyib natija! Siz "{selectedGroup}" guruhini muvaffaqiyatli yakunladingiz.</p>
                <div className="mt-8 flex justify-center gap-4">
                    <button 
                        onClick={() => setSelectedGroup(null)} 
                        className="px-6 py-2 bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition"
                    >
                        Ortga Qaytish
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto px-4 animate-fade-in">
            <button 
                onClick={() => setSelectedGroup(null)}
                className="mb-8 text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors font-medium bg-secondary px-4 py-2 rounded-lg inline-flex"
            >
                <ChevronLeft className="w-4 h-4" /> Chiqish
            </button>

            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span className="w-2 h-8 bg-pink-500 rounded-full inline-block"></span>
                    {selectedGroup} Review
                </h2>
                <span className="text-sm bg-muted text-muted-foreground px-3 py-1 rounded-full border border-border font-bold">
                    {currentIndex + 1} / {sessionWords.length}
                </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 bg-secondary rounded-full overflow-hidden mb-8 border border-border/50">
                <div 
                    className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-500 ease-out"
                    style={{ width: `${((currentIndex + (feedback ? 1 : 0)) / sessionWords.length) * 100}%` }}
                ></div>
            </div>

            <div className="bg-card p-8 rounded-3xl border border-border shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition duration-500 group-hover:bg-pink-500/20"></div>

                <div className="text-center mb-8">
                    {error && <div className="text-destructive mb-4 text-sm animate-pulse">{error}</div>}
                    <p className="text-muted-foreground text-sm tracking-widest uppercase mb-2 font-bold">Maqsadli So'z</p>
                    <h3 className="text-5xl font-black text-card-foreground mb-4 tracking-tight capitalize">{word.word}</h3>
                    <p className="text-muted-foreground italic">"{word.definition}"</p>
                </div>

                {!feedback ? (
                    <div className="space-y-4">
                        <label className="block text-sm text-card-foreground ml-1">
                            <strong>{word.word}</strong> so'zini gap ichida ishlating:
                        </label>
                        <div className="relative group">
                            <textarea 
                                className={`w-full bg-background border rounded-xl p-4 pr-16 text-lg outline-none transition-all resize-none text-foreground ${isListening ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-border focus:border-pink-500 focus:ring-1 focus:ring-pink-500'}`}
                                rows="3"
                                placeholder="Gapingizni yozing yoki mikrofondan foydalaning (ingliz tilida)..."
                                value={userSentence}
                                onChange={(e) => setUserSentence(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleCheck()}
                            />
                            <button 
                                onClick={toggleListening}
                                className={`absolute bottom-4 right-4 p-3 rounded-full transition-all ${isListening ? 'bg-destructive text-white animate-pulse shadow-lg shadow-destructive/40' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                                title="Gapirish (Ingliz)"
                            >
                                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </button>
                        </div>
                        <button 
                            onClick={handleCheck}
                            disabled={checking || !userSentence.trim()}
                            className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl font-bold text-lg hover:opacity-90 transition-all disabled:opacity-50 flex justify-center items-center gap-2 text-white"
                        >
                            {checking ? 'Tekshirilmoqda...' : 'Tekshirish ✨'}
                        </button>
                    </div>
                ) : (
                    <div className={`mt-6 p-6 rounded-2xl border ${feedback.isCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-destructive/10 border-destructive/30'} animate-fade-in`}>
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-3xl">{feedback.isCorrect ? '✅' : '❌'}</span>
                            <h4 className={`text-xl font-bold ${feedback.isCorrect ? 'text-green-500' : 'text-destructive'}`}>
                                {feedback.isCorrect ? 'Ajoyib!' : 'Xato ketib qoldi'}
                            </h4>
                        </div>
                        <p className="text-card-foreground mb-6 leading-relaxed">
                            {feedback.feedback}
                        </p>
                        
                        <button 
                            onClick={handleNext}
                            className={`w-full py-3 rounded-xl font-bold transition-all ${
                                feedback.isCorrect 
                                ? 'bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-500/20' 
                                : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                            }`}
                        >
                            {currentIndex < sessionWords.length - 1 ? 'Keyingi So\'z →' : 'Sessiyani Yakunlash 🎉'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewMode;
