import React, { useState, useEffect, useRef } from 'react';
import { useGetWordsQuery, useChatRoleplayMutation } from '../features/api/apiSlice';
import { groupWordsByReviewInterval } from '../utils/dateUtils';
import { Loader2, Mic, MicOff, SendHorizontal, ChevronLeft, Volume2, Coffee, PlaneTakeoff, Briefcase, MapPin } from 'lucide-react';

const SCENARIOS = [
    { id: 'cafe', title: 'Qahvaxona', icon: <Coffee className="w-8 h-8" />, desc: 'Barista bilan qahva va shirinliklar buyurtma qilish.', bg: 'from-orange-400 to-amber-600' },
    { id: 'airport', title: 'Aeroport', icon: <PlaneTakeoff className="w-8 h-8" />, desc: 'Bojxona xodimi bilan pasport nazoratidan o\'tish.', bg: 'from-blue-400 to-indigo-600' },
    { id: 'interview', title: 'Suhbat (Interview)', icon: <Briefcase className="w-8 h-8" />, desc: 'HR menejer bilan ishga kirish suhbatida qatnashish.', bg: 'from-slate-600 to-slate-900' },
    { id: 'street', title: 'Ko\'chada', icon: <MapPin className="w-8 h-8" />, desc: 'Notanish odamdan manzilni so\'rash.', bg: 'from-emerald-400 to-teal-600' }
];

const RoleplayMode = () => {
    const { data: words = [] } = useGetWordsQuery();
    const [chatRoleplay] = useChatRoleplayMutation();

    const [activeScenario, setActiveScenario] = useState(null);
    const [messages, setMessages] = useState([]); // { role: 'user' | 'ai', content: '...' }
    const [inputText, setInputText] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    
    // Voice State
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState(null);
    const [error, setError] = useState(null);

    const messagesEndRef = useRef(null);

    // Auto-scroll to bottom of chat
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isTyping]);

    // Initialize Speech Recognition
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
                setInputText(finalTrans || interimTrans);
            };

            rec.onend = () => {
                setIsListening(false);
            };

            rec.onerror = (e) => {
                setIsListening(false);
                setError("Mikrofon xatoligi. Ruxsat berilganini tekshiring.");
            };

            setRecognition(rec);
        }
    }, []);

    const toggleListening = () => {
        if (!recognition) return;
        if (isListening) {
            recognition.stop();
        } else {
            setError(null);
            recognition.start();
            setIsListening(true);
        }
    };

    // Text-to-Speech
    const playAudio = (text) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Stop current playing
            const msg = new SpeechSynthesisUtterance(text);
            msg.lang = 'en-US';
            msg.rate = 0.95; // Slightly slower for clarity
            window.speechSynthesis.speak(msg);
        }
    };

    // Get Target Words for AI
    const getTargetWords = () => {
        const grouped = groupWordsByReviewInterval(words);
        const overdue = grouped["Overdue 🚨"] || [];
        const dueToday = grouped["Due Today 🎯"] || [];
        // Combine, take up to 5 words to keep it focused
        return [...overdue, ...dueToday].slice(0, 5).map(w => w.word);
    };

    // Start a Scenario
    const startScenario = async (scenario) => {
        setActiveScenario(scenario);
        setMessages([]);
        setIsTyping(true);

        const targetWords = getTargetWords();

        try {
            // Initial greeting trigger - sending an empty invisible context message 
            // to prompt the AI to start the conversation as the character.
            const data = await chatRoleplay({
                scenario: scenario.title,
                targetWords,
                chatHistory: [],
                message: "[SYSTEM EVENT: User has entered the scenario. Introduce yourself and say hello according to your role.]"
            }).unwrap();

            setMessages([{ role: 'ai', content: data.reply }]);
            playAudio(data.reply);
        } catch (err) {
            setError("Server tarmog'ida xatolik yuz berdi.");
        } finally {
            setIsTyping(false);
        }
    };

    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        
        const text = inputText.trim();
        if (!text) return;

        // Stop TTS if user is interrupting
        window.speechSynthesis?.cancel();
        
        if (isListening) recognition.stop();

        const newMessages = [...messages, { role: 'user', content: text }];
        setMessages(newMessages);
        setInputText("");
        setIsTyping(true);

        try {
            const data = await chatRoleplay({
                scenario: activeScenario.title,
                targetWords: getTargetWords(),
                chatHistory: messages, // Send prev context
                message: text
            }).unwrap();

            setMessages(prev => [...prev, { role: 'ai', content: data.reply }]);
            playAudio(data.reply);
        } catch (err) {
             setMessages(prev => [...prev, { role: 'ai', content: "Muloqot uzildi, iltimos qayta yuboring." }]);
        } finally {
            setIsTyping(false);
        }
    };

    const exitScenario = () => {
        window.speechSynthesis?.cancel();
        if (isListening && recognition) recognition.stop();
        setActiveScenario(null);
        setMessages([]);
        setInputText("");
    };

    // VIEW 1: SCENARIO SELECTION
    if (!activeScenario) {
        return (
            <div className="max-w-4xl mx-auto px-4 animate-fade-in text-center">
                <div className="mb-12">
                   <h2 className="text-2xl md:text-5xl font-black bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent mb-4">
                      Immersion Mode 🎭
                   </h2>
                   <p className="text-muted-foreground text-base md:text-lg">Haqiqiy holatlarda AI bilan gaplashib amaliyot qiling va yodlagan so'zlaringizni ishlating.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                    {SCENARIOS.map((s) => (
                        <div 
                            key={s.id} 
                            onClick={() => startScenario(s)}
                            className={`bg-gradient-to-br ${s.bg} rounded-3xl p-6 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer group relative overflow-hidden text-white`}
                        >
                            <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all"></div>
                            
                            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                {s.icon}
                            </div>
                            <h3 className="text-xl md:text-2xl font-bold mb-2">
                                {s.title}
                            </h3>
                            <p className="text-white/80 text-sm mb-4 leading-relaxed font-medium">
                                {s.desc}
                            </p>
                            <div className="flex items-center text-sm font-bold mt-auto group-hover:translate-x-2 transition-transform">
                                Suhbatni Boshlash &rarr;
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // VIEW 2: ACTIVE CHAT ROLEPLAY
    return (
        <div className="max-w-3xl mx-auto px-4 animate-fade-in flex flex-col h-[80vh]">
            {/* Chat Header */}
            <div className="flex items-center justify-between bg-card border border-border rounded-t-3xl p-4 shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={exitScenario}
                        className="p-2 bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h3 className="font-bold text-card-foreground flex items-center gap-2">
                            {activeScenario.icon} {activeScenario.title}
                        </h3>
                        <p className="text-xs text-muted-foreground font-medium">AI Partner • Always Online</p>
                    </div>
                </div>
                <div className="hidden md:block text-xs font-medium text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                    Ovozli Chat Faol 🟢
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto bg-muted/30 p-4 border-x border-border space-y-6">
                {messages.length === 0 && !isTyping && (
                    <div className="text-center text-muted-foreground mt-10">
                        <p>Suhbat boshlanmoqda...</p>
                    </div>
                )}
                
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                        <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                            msg.role === 'user' 
                            ? 'bg-primary text-primary-foreground rounded-br-none' 
                            : 'bg-card border border-border text-card-foreground rounded-bl-none'
                        }`}>
                            
                            {msg.role === 'ai' && (
                                <button 
                                    onClick={() => playAudio(msg.content)}
                                    className="mb-2 p-1.5 bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 flex items-center gap-1 text-xs font-bold"
                                    title="Eshitish"
                                >
                                    <Volume2 className="w-3 h-3" /> Eshitish
                                </button>
                            )}
                            
                            <p className="leading-relaxed text-[15px] md:text-base whitespace-pre-wrap">{msg.content}</p>
                            
                        </div>
                    </div>
                ))}
                
                {isTyping && (
                    <div className="flex justify-start animate-fade-in">
                        <div className="bg-card border border-border p-4 rounded-2xl rounded-bl-none shadow-sm text-muted-foreground flex items-center gap-2">
                           <Loader2 className="w-4 h-4 animate-spin" /> Yozmoqda...
                        </div>
                    </div>
                )}
                
                {error && (
                    <div className="text-center p-2 bg-destructive/10 text-destructive text-sm rounded-lg border border-destructive/20 animate-pulse mt-4">
                        {error}
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-card border border-border rounded-b-3xl p-4 shrink-0 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                <form onSubmit={handleSendMessage} className="flex items-end gap-2 relative group">
                    <button 
                        type="button"
                        onClick={toggleListening}
                        className={`p-4 rounded-full transition-all shrink-0 ${isListening ? 'bg-destructive text-white animate-pulse shadow-lg shadow-destructive/40 scale-105' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                        title="Ovozli Kiritish"
                    >
                        {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    </button>
                    
                    <textarea 
                        className={`flex-1 bg-background border rounded-2xl py-3 px-4 outline-none transition-all resize-none text-foreground text-sm md:text-base placeholder:text-sm md:placeholder:text-base ${isListening ? 'border-orange-500 ring-2 ring-orange-500/20 placeholder-orange-500/50' : 'border-border focus:border-primary focus:ring-1 focus:ring-primary'}`}
                        rows="1"
                        style={{ minHeight: '52px', maxHeight: '120px' }}
                        placeholder={isListening ? "Eshitmoqdaman (Ingliz tilida gapiring)..." : "Xabar yozing..."}
                        value={inputText}
                        onChange={(e) => {
                            setInputText(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = (e.target.scrollHeight) + 'px';
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                    />

                    <button 
                        type="submit"
                        disabled={!inputText.trim() || isTyping}
                        className="p-4 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                        <SendHorizontal className="w-6 h-6" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default RoleplayMode;
