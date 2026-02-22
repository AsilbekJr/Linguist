import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setActiveTab } from './features/ui/uiSlice';
import { 
  useGetWordsQuery, 
  useAddWordMutation, 
  useDeleteWordMutation 
} from './features/api/apiSlice';
import WordCard from './components/WordCard';
import WordForm from './components/WordForm';
import ReviewMode from './components/ReviewMode';
import Dictionary from './components/Dictionary';
import SpeakingLab from './components/SpeakingLab';
import RoleplayMode from './components/RoleplayMode';
import { groupWordsByDate } from './utils/dateUtils';
import Sidebar from './components/Sidebar';
import { CheckCircle2, ChevronLeft, Calendar } from 'lucide-react';

function App() {
  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
  
  // RTK UI State
  const activeTab = useSelector((state) => state.ui.activeTab);
  const [activeDateGroup, setActiveDateGroup] = useState(null);
  const dispatch = useDispatch();

  // RTK Query State
  const { data: words = [], isLoading, isError: isWordsError } = useGetWordsQuery();
  const [addWordMutation] = useAddWordMutation();
  const [deleteWordMutation] = useDeleteWordMutation();

  const [error, setError] = useState(null);
  const [reviewDueCount, setReviewDueCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchReviewCount = async () => {
      try {
          const res = await fetch(`${API_URL}/api/review/due`);
          const data = await res.json();
          setReviewDueCount(Array.isArray(data) ? data.length : 0);
      } catch (err) {
          console.error("Failed to fetch review count", err);
      }
  };

  // Re-fetch review count whenever the RTK Query 'words' data updates 
  // (e.g. after a checkReviewMutation invalidates the Word tag)
  useEffect(() => {
    fetchReviewCount();
  }, [words]);

  const handleTabChange = (tab) => {
    dispatch(setActiveTab(tab));
    setActiveDateGroup(null); // Reset date group when changing tabs
  };

  // fetchReviewCount moved up

  const handleAddWord = async (newWord, skipAI = false, manualData = {}) => {
     try {
        const payload = { 
            word: newWord, 
            skipAI,
            manualDefinition: manualData.manualDefinition,
            manualExamples: manualData.manualExample ? [manualData.manualExample] : [],
            manualTranslation: manualData.manualTranslation
        };

        await addWordMutation(payload).unwrap();
        setError(null);
     } catch (err) {
         console.error("Error adding word:", err);

         // RTK Query wraps standard API errors in `err.data` when using `unwrap()`
         const errorData = err.data || err;

         if (errorData.type === 'DUPLICATE' || errorData.type === 'INVALID' || errorData.type === 'QUOTA_EXCEEDED') {
             throw errorData; // Pass down to WordForm
         }

         setError("Failed to add word. Is server running?");
     }
  };

  const handleDeleteWord = async (id) => {
      try {
          await deleteWordMutation(id).unwrap();
      } catch (err) {
          console.error("Delete failed:", err);
          setError("Failed to delete word.");
      }
  };

  const groupedWords = useMemo(() => groupWordsByDate(words), [words]);

  const filteredWords = useMemo(() => {
    if (!searchQuery) return words;
    return words.filter(word => 
      word.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (word.translation && word.translation.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (word.definition && word.definition.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [words, searchQuery]);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 font-sans">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12 pt-20 md:pt-12">
        
        {/* Header Section */}
        <header className="mb-8 md:mb-12 text-center pt-2 md:pt-0">
          <h1 className="text-4xl md:text-6xl font-black text-primary mb-4 tracking-tight drop-shadow-sm">
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
                onClick={() => handleTabChange('word-lab')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 border ${
                    activeTab === 'word-lab' 
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 border-primary' 
                    : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground border-border'
                }`}
            >
                🧪 Word Lab
            </button>
            <button 
                onClick={() => handleTabChange('review-mode')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 relative border ${
                    activeTab === 'review-mode' 
                    ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/25 border-pink-600' 
                    : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground border-border'
                }`}
            >
                🧠 Takrorlash
                {reviewDueCount > 0 && (
                    <span className="absolute -top-2 -right-2 w-6 h-6 bg-destructive rounded-full flex items-center justify-center text-xs text-white border-2 border-background animate-bounce font-black shadow-md shadow-destructive/50">
                        {reviewDueCount}
                    </span>
                )}
            </button>
            <button 
                onClick={() => handleTabChange('dictionary')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 border ${
                    activeTab === 'dictionary' 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 border-blue-600' 
                    : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground border-border'
                }`}
            >
                📖 Dictionary
            </button>
            <button 
                onClick={() => handleTabChange('speaking-lab')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 border ${
                    activeTab === 'speaking-lab' 
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25 border-orange-500' 
                    : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground border-border'
                }`}
            >
                🎙️ Speaking Lab
            </button>
            <button 
                onClick={() => handleTabChange('roleplay')}
                className={`px-6 py-2 rounded-full font-bold transition-all flex items-center gap-2 border ${
                    activeTab === 'roleplay' 
                    ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/25 border-teal-500' 
                    : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground border-border'
                }`}
            >
                🎭 Immersion
            </button>
        </div>

        {/* Search Bar - Hidden on Mobile if active is review-mode, or active date group is null (so we only search inside groups for now, or you can leave it out) */}
        <div className={`mb-12 ${(activeTab === 'review-mode' || activeTab === 'speaking-lab' || activeTab === 'dictionary' || activeTab === 'roleplay') ? 'hidden' : 'block'}`}>
            {(!activeDateGroup && activeTab === 'word-lab') ? null : (
            <div className="relative group max-w-2xl mx-auto">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-muted-foreground group-focus-within:text-primary transition-colors">🔍</span>
                </div>
                <input 
                    type="text" 
                    placeholder="Search your vocabulary..."
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-card border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none transition-all shadow-sm focus:shadow-md text-foreground placeholder:text-muted-foreground text-lg"
                />
            </div>
            )}
        </div>

        {/* Content Area */}
        <main className="animate-fade-in-up">
            {activeTab === 'word-lab' && (
                <section className="animate-fade-in-up">
                    <div className="max-w-2xl mx-auto mb-12">
                        <WordForm onAddWord={handleAddWord} />
                    </div>

                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                           <span className="text-3xl">🧪</span> Your Word Lab
                        </h2>
                        <span className="text-sm bg-primary/10 text-primary px-4 py-2 rounded-full font-bold border border-primary/20">
                            {filteredWords.length} Words Total
                        </span>
                    </div>

                    {!activeDateGroup ? (
                        /* DATE GROUP CARDS VIEW */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                            {Object.entries(groupedWords).map(([date, wordsInGroup]) => (
                                <div 
                                    key={date} 
                                    onClick={() => setActiveDateGroup(date)}
                                    className="bg-card rounded-3xl p-6 border border-border shadow-md hover:shadow-xl hover:-translate-y-1 hover:border-primary/50 transition-all cursor-pointer group"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-primary">
                                        <Calendar className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-card-foreground mb-2">
                                        {date}
                                    </h3>
                                    <p className="text-muted-foreground text-sm mb-4">
                                        {wordsInGroup.length} ta so'z
                                    </p>
                                    <div className="flex items-center text-primary text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                        View words &rarr;
                                    </div>
                                </div>
                            ))}
                            {Object.keys(groupedWords).length === 0 && (
                                <div className="col-span-full text-center py-16 bg-card border border-border border-dashed rounded-3xl">
                                    <p className="text-xl text-muted-foreground">Flow is empty.</p>
                                    <p className="text-sm text-muted-foreground mt-2">Start adding words above!</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* WORD CARDS IN SELECTED DATE GROUP */
                        <div className="animate-fade-in">
                            <button 
                                onClick={() => setActiveDateGroup(null)}
                                className="mb-8 text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors font-medium bg-secondary px-4 py-2 rounded-lg"
                            >
                                <ChevronLeft className="w-4 h-4" /> Back to Dates
                            </button>
                            
                            <h3 className="text-xl font-bold mb-6 text-card-foreground flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-primary" /> {activeDateGroup}
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {groupedWords[activeDateGroup]
                                    .filter(word => word.word.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                                    (word.translation && word.translation.toLowerCase().includes(searchQuery.toLowerCase())))
                                    .map((word) => (
                                    <WordCard 
                                        key={word._id} 
                                        word={word} 
                                        onDelete={handleDeleteWord}
                                    />
                                ))}
                                {groupedWords[activeDateGroup].filter(word => word.word.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                                    (word.translation && word.translation.toLowerCase().includes(searchQuery.toLowerCase()))).length === 0 && (
                                    <div className="col-span-full py-16 text-center text-muted-foreground">
                                        No words match your search in this group.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </section>
            )}

            {activeTab === 'review-mode' && <ReviewMode />}

            {activeTab === 'dictionary' && <Dictionary onAddWord={handleAddWord} userWords={words} />}

            {activeTab === 'speaking-lab' && <SpeakingLab />}

            {activeTab === 'roleplay' && <RoleplayMode />}
        </main>
      </div>
    </div>
  )
}

export default App;
