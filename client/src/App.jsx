import React, { useState, useEffect } from 'react'
import WordCard from './components/WordCard';
import WordForm from './components/WordForm';
import StoryEditor from './components/StoryEditor';
import StoryLibrary from './components/StoryLibrary';

function App() {
  const [words, setWords] = useState([])
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('word-lab'); // 'word-lab' | 'story-mode' | 'library'

  useEffect(() => {
    fetchwords();
  }, [])

  const fetchwords = () => {
    // Use environment variable for API URL in production
    const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
    
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

  const handleAddWord = async (newWord) => {
    console.log("Adding word:", newWord);
    
    // Optimistic update
    const mockNewEntry = {
        _id: Date.now().toString(),
        word: newWord,
        definition: "AI is generating definition...",
        examples: ["Please wait..."],
        mastered: false
    };
    
    setWords(prev => [mockNewEntry, ...prev]);

     try {
        const res = await fetch(`${API_URL}/api/words`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ word: newWord })
        });
        
        if (!res.ok) throw new Error("Server error");
        
        const savedWord = await res.json();
        
        // Update the optimistic entry with real data
        setWords(prev => prev.map(w => w._id === mockNewEntry._id ? savedWord : w));
        setError(null);

     } catch (err) {
         console.error("Error adding word:", err);
         setError("Failed to generate context. Is server running?");
     }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-blue-500/30 font-sans">
      <div className="max-w-7xl mx-auto px-6 py-12">
        
        {/* Header Section */}
        <header className="mb-12 text-center">
          <h1 className="text-6xl font-black bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent mb-4 tracking-tight">
            Linguist AI-Flow
          </h1>
          <p className="text-xl text-gray-400 mb-8">
            Don't just memorize. <span className="text-white font-semibold">Feel. Contextualize. Master.</span>
          </p>
          
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 text-red-500 px-4 py-2 rounded-lg inline-block text-sm font-medium">
              ⚠️ {error}
            </div>
          )}
        </header>

        {/* Navigation Tabs */}
        <div className="flex justify-center gap-4 mb-12">
            <button 
                onClick={() => setActiveTab('word-lab')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 ${
                    activeTab === 'word-lab' 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
            >
                🧪 Word Lab
            </button>
            <button 
                onClick={() => setActiveTab('story-mode')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 ${
                    activeTab === 'story-mode' 
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
            >
                📝 Story Mode
            </button>
            <button 
                onClick={() => setActiveTab('library')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 ${
                    activeTab === 'library' 
                    ? 'bg-green-600 text-white shadow-lg shadow-green-500/25' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
            >
                📚 Library
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
                        <span className="w-2 h-8 bg-blue-500 rounded-full inline-block"></span>
                        Your Ecosystem
                        </h2>
                        <span className="text-gray-500 text-sm border border-gray-800 px-3 py-1 rounded-full">
                        {words.length} words collected
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.isArray(words) && words.map(word => (
                        <WordCard key={word._id} word={word} />
                        ))}
                    </div>
                    
                    {words.length === 0 && (
                        <div className="text-center text-gray-500 py-20 bg-gray-900/50 rounded-3xl border border-gray-800 border-dashed">
                        <p className="text-xl">Your flow is empty.</p>
                        <p className="text-sm mt-2">Add a word to start building your universe.</p>
                        </div>
                    )}
                </>
            )}
            
            {activeTab === 'story-mode' && <StoryEditor words={words} />}
            
            {activeTab === 'library' && <StoryLibrary />}
        </main>
      </div>
    </div>
  )
}

export default App
