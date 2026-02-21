import React, { useState, useEffect } from 'react';
import WordCard from './components/WordCard';
import WordForm from './components/WordForm';
import StoryEditor from './components/StoryEditor';
import StoryLibrary from './components/StoryLibrary';
import ReviewMode from './components/ReviewMode';
import Dictionary from './components/Dictionary';
import { groupWordsByDate } from './utils/dateUtils';
import Sidebar from './components/Sidebar';

function App() {
  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
  const [words, setWords] = useState([])
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('word-lab'); // 'word-lab' | 'story-mode' | 'library' | 'review-mode'
  const [reviewDueCount, setReviewDueCount] = useState(0);

  useEffect(() => {
    fetchwords();
    fetchReviewCount();
  }, [])
  
  const fetchReviewCount = async () => {
      try {
          const res = await fetch(`${API_URL}/api/review/due`);
          const data = await res.json();
          setReviewDueCount(Array.isArray(data) ? data.length : 0);
      } catch (err) {
          console.error("Failed to fetch review count", err);
      }
  };

  const fetchwords = () => {
    fetch(`${API_URL}/api/words`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to connect to server");
        return res.json();
      })
      .then(data => {
        setWords(data);
        setError(null);
      })
      .catch(err => {
        console.error(err);
        setError("Server unavailable. Please check backend.");
      })
  };

  const handleAddWord = async (newWord, skipAI = false, manualData = {}) => {
    // Optimistic update
    const mockNewEntry = {
        _id: Date.now().toString(),
        word: newWord,
        definition: skipAI && manualData.manualDefinition ? manualData.manualDefinition : (skipAI ? "Definition unavailable." : "AI is generating definition..."),
        examples: skipAI && manualData.manualExample ? [manualData.manualExample] : (skipAI ? ["Example unavailable."] : ["Please wait..."]),
        mastered: false
    };
    
    setWords(prev => [mockNewEntry, ...prev]);

     try {
        const res = await fetch(`${API_URL}/api/words`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                word: newWord, 
                skipAI,
                manualDefinition: manualData.manualDefinition,
                manualExamples: manualData.manualExample ? [manualData.manualExample] : [],
                manualTranslation: manualData.manualTranslation
            })
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            throw errorData;
        }
        
        const savedWord = await res.json();
        
        // Update the optimistic entry with real data
        setWords(prev => prev.map(w => w._id === mockNewEntry._id ? savedWord : w));
        setError(null);

     } catch (err) {
         console.error("Error adding word:", err);
         // Remove optimistic update
         setWords(prev => prev.filter(w => w._id !== mockNewEntry._id));

         if (err.type === 'DUPLICATE' || err.type === 'INVALID' || err.type === 'QUOTA_EXCEEDED') {
             throw err; // Pass to WordForm
         }

         setError("Failed to add word. Is server running?");
     }
  };

  const handleDeleteWord = async (id) => {
      setWords(prev => prev.filter(w => w._id !== id)); // Optimistic delete
      try {
          await fetch(`${API_URL}/api/words/${id}`, { method: 'DELETE' });
      } catch (err) {
          console.error("Delete failed:", err);
          fetchwords(); // Revert on failure
      }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 font-sans">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12 pt-20 md:pt-12">
        
        {/* Header Section */}
        <header className="mb-8 md:mb-12 text-center pt-2 md:pt-0">
          <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent mb-4 tracking-tight">
            Linguist AI-Flow
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 text-balance">
            Don't just memorize. <span className="text-foreground font-semibold">Feel. Contextualize. Master.</span>
          </p>
          
          {error && (
            <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-2 rounded-lg inline-block text-sm font-medium animate-pulse">
              ⚠️ {error}
            </div>
          )}
        </header>

        {/* Desktop Navigation Tabs (Hidden on Mobile) */}
        <div className="hidden md:flex justify-center gap-4 mb-12">
            <button 
                onClick={() => setActiveTab('word-lab')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 border ${
                    activeTab === 'word-lab' 
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 border-primary' 
                    : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground border-border'
                }`}
            >
                🧪 Word Lab
            </button>
            <button 
                onClick={() => setActiveTab('story-mode')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 border ${
                    activeTab === 'story-mode' 
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25 border-purple-600' 
                    : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground border-border'
                }`}
            >
                📝 Story Mode
            </button>
            <button 
                onClick={() => setActiveTab('library')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 border ${
                    activeTab === 'library' 
                    ? 'bg-green-600 text-white shadow-lg shadow-green-500/25 border-green-600' 
                    : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground border-border'
                }`}
            >
                📚 Library
            </button>
            <button 
                onClick={() => setActiveTab('review-mode')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 relative border ${
                    activeTab === 'review-mode' 
                    ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/25 border-pink-600' 
                    : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground border-border'
                }`}
            >
                🧠 Review
                {reviewDueCount > 0 && (
                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-destructive rounded-full flex items-center justify-center text-xs text-white border-2 border-background animate-bounce">
                        {reviewDueCount}
                    </span>
                )}
            </button>
        </div>

        {/* Content Area */}
        <main className="animate-fade-in-up">
            {activeTab === 'word-lab' && (
                <>
                    {/* Word Lab Content */}
                    <div className="max-w-2xl mx-auto">
                        <WordForm onAddWord={handleAddWord} />
                    </div>

                    <div className="flex justify-between items-center mb-8 mt-12">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                        <span className="w-2 h-8 bg-primary rounded-full inline-block"></span>
                        Your Ecosystem
                        </h2>
                        <span className="text-muted-foreground text-sm border border-border px-3 py-1 rounded-full">
                        {words.length} words collected
                        </span>
                    </div>

                    <div className="space-y-12">
                        {(() => {
                            const groupedWords = groupWordsByDate(words);
                            return Object.entries(groupedWords).map(([dateLabel, groupWords]) => (
                                <div key={dateLabel} className="animate-fade-in">
                                    <h3 className="text-lg font-bold text-muted-foreground mb-6 flex items-center gap-4 sticky top-14 md:top-0 bg-background/95 py-4 z-10 backdrop-blur-md">
                                        <span className={`w-2 h-2 rounded-full ${dateLabel.includes('Today') ? 'bg-primary shadow-lg shadow-primary/50' : 'bg-muted-foreground/50'}`}></span>
                                        {dateLabel}
                                        <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                                            {groupWords.length}
                                        </span>
                                        <div className="h-[1px] flex-1 bg-gradient-to-r from-border to-transparent"></div>
                                    </h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        {groupWords.map(word => (
                                            <WordCard key={word._id} word={word} onDelete={handleDeleteWord} />
                                        ))}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                    
                    {words.length === 0 && (
                        <div className="text-center text-muted-foreground py-20 bg-muted/30 rounded-3xl border border-border border-dashed">
                        <p className="text-xl">Your flow is empty.</p>
                        <p className="text-sm mt-2">Add a word to start building your universe.</p>
                        </div>
                    )}
                </>
            )}
            
            {activeTab === 'story-mode' && <StoryEditor words={words} />}
            
            {activeTab === 'library' && <StoryLibrary />}

            {activeTab === 'review-mode' && <ReviewMode />}

            {activeTab === 'dictionary' && <Dictionary onAddWord={handleAddWord} userWords={words} />}
        </main>
      </div>
    </div>
  )
}

export default App
