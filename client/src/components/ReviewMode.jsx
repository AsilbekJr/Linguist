import React, { useState, useEffect } from 'react';

const ReviewMode = () => {
    const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
    const [dueWords, setDueWords] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userSentence, setUserSentence] = useState('');
    const [feedback, setFeedback] = useState(null);
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        fetchDueWords();
    }, []);

    const fetchDueWords = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/review/due`);
            const data = await res.json();
            setDueWords(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Error fetching review words:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCheck = async () => {
        if (!userSentence.trim()) return;

        setChecking(true);
        const currentWord = dueWords[currentIndex];

        try {
            const res = await fetch(`${API_URL}/api/review/${currentWord._id}/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sentence: userSentence })
            });
            const data = await res.json();
            setFeedback(data); // { isCorrect, feedback, nextReviewDate }
        } catch (error) {
            console.error("Check error:", error);
        } finally {
            setChecking(false);
        }
    };

    const handleNext = () => {
        setFeedback(null);
        setUserSentence('');
        if (currentIndex < dueWords.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            // Finished all reviews
            setDueWords([]); 
        }
    };

    if (loading) return <div className="text-center py-20 animate-pulse">Loading reviews...</div>;

    if (!Array.isArray(dueWords) || dueWords.length === 0) {
        return (
            <div className="text-center py-20">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent mb-4">
                    All Caught Up!
                </h2>
                <p className="text-muted-foreground">You've reviewed all your due words for today.</p>
                <div className="mt-8">
                    <button 
                        onClick={() => window.location.reload()} 
                        className="px-6 py-2 bg-secondary text-secondary-foreground rounded-full hover:bg-secondary/80 transition"
                    >
                        Refresh Flow
                    </button>
                </div>
            </div>
        );
    }

    const word = dueWords[currentIndex];

    return (
        <div className="max-w-2xl mx-auto px-4">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <span className="w-2 h-8 bg-pink-500 rounded-full inline-block"></span>
                    Review Session
                </h2>
                <span className="text-sm bg-muted text-muted-foreground px-3 py-1 rounded-full">
                    {currentIndex + 1} / {dueWords.length}
                </span>
            </div>

            <div className="bg-card p-8 rounded-3xl border border-border shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition duration-500 group-hover:bg-pink-500/20"></div>

                <div className="text-center mb-8">
                    <p className="text-muted-foreground text-sm tracking-widest uppercase mb-2">Target Word</p>
                    <h3 className="text-5xl font-black text-card-foreground mb-4 tracking-tight capitalize">{word.word}</h3>
                    <p className="text-muted-foreground italic">"{word.definition}"</p>
                </div>

                {!feedback ? (
                    <div className="space-y-4">
                        <label className="block text-sm text-card-foreground ml-1">
                            Use <strong>{word.word}</strong> in a sentence:
                        </label>
                        <textarea 
                            className="w-full bg-background border border-border rounded-xl p-4 text-lg focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none transition-all resize-none text-foreground"
                            rows="3"
                            placeholder="Type your sentence here..."
                            value={userSentence}
                            onChange={(e) => setUserSentence(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleCheck()}
                        />
                        <button 
                            onClick={handleCheck}
                            disabled={checking || !userSentence.trim()}
                            className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl font-bold text-lg hover:opacity-90 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
                        >
                            {checking ? 'Analyzing...' : 'Check My Flow ✨'}
                        </button>
                    </div>
                ) : (
                    <div className={`mt-6 p-6 rounded-2xl border ${feedback.isCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-destructive/10 border-destructive/30'} animate-fade-in`}>
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-3xl">{feedback.isCorrect ? '✅' : '❌'}</span>
                            <h4 className={`text-xl font-bold ${feedback.isCorrect ? 'text-green-500' : 'text-destructive'}`}>
                                {feedback.isCorrect ? 'Excellent!' : 'Needs Improvement'}
                            </h4>
                        </div>
                        <p className="text-card-foreground mb-6 leading-relaxed">
                            {feedback.feedback}
                        </p>
                        
                        <button 
                            onClick={handleNext}
                            className={`w-full py-3 rounded-xl font-bold transition-all ${
                                feedback.isCorrect 
                                ? 'bg-green-600 hover:bg-green-500 text-white' 
                                : 'bg-secondary hover:bg-secondary/80 text-secondary-foreground'
                            }`}
                        >
                            {currentIndex < dueWords.length - 1 ? 'Next Word →' : 'Finish Session 🎉'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewMode;
