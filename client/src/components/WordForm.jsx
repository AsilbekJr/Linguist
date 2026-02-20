import React, { useState } from 'react';

const WordForm = ({ onAddWord }) => {
  const [word, setWord] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showForceSave, setShowForceSave] = useState(false);

  const handleSubmit = async (e, skipAI = false) => {
    if (e) e.preventDefault();
    if (!word.trim()) return;

    setLoading(true);
    setError(null);
    setSuggestions([]);
    setShowForceSave(false);

    try {
      await onAddWord(word, skipAI);
      setWord('');
    } catch (err) {
      console.error("Add Word Error:", err);
      if (err.type === 'INVALID') {
          setError(err.message);
          setSuggestions(err.suggestions || []);
      } else if (err.type === 'DUPLICATE') {
          setError(err.message);
      } else if (err.type === 'QUOTA_EXCEEDED') {
          setError(err.message);
          setShowForceSave(true);
      } else {
          setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
      setWord(suggestion);
      setError(null);
      setSuggestions([]);
      setShowForceSave(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-12">
        <form onSubmit={(e) => handleSubmit(e, false)} className="relative w-full">
        <div className="relative flex items-center">
            <input
            type="text"
            value={word}
            onChange={(e) => {
                setWord(e.target.value);
                setError(null);
                setShowForceSave(false);
            }}
            placeholder="Type a word to add to your ecosystem..."
            className={`w-full bg-gray-800/50 backdrop-blur-sm text-white text-lg px-6 py-4 rounded-full border ${error ? 'border-red-500' : 'border-gray-600'} focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-500`}
            disabled={loading}
            />
            <button
            type="submit"
            disabled={loading || !word.trim()}
            className="absolute right-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
            {loading ? (
                <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Stats
                </span>
            ) : 'Add Word'}
            </button>
        </div>
        
        {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl animate-fade-in">
                <p className="text-red-400 flex items-center gap-2">
                    <span>⚠️</span> {error}
                </p>
                
                {showForceSave && (
                    <div className="mt-3 flex flex-col gap-2">
                         <p className="text-gray-400 text-sm">You can still save this word, but definitions won't be generated right now.</p>
                         <button 
                            type="button"
                            onClick={() => handleSubmit(null, true)}
                            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold transition-colors w-fit text-sm"
                         >
                             Save Without AI
                         </button>
                    </div>
                )}

                {suggestions.length > 0 && (
                    <div className="mt-3">
                        <p className="text-sm text-gray-400 mb-2">Did you mean:</p>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => handleSuggestionClick(s)}
                                    className="bg-gray-800 hover:bg-gray-700 text-blue-400 text-sm px-3 py-1 rounded-lg transition-colors border border-gray-700 hover:border-blue-500/50"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

        {!error && (
            <p className="text-center text-gray-500 text-sm mt-3">
                Enter a word, and AI will generate context, stories, and connections.
            </p>
        )}
        </form>
    </div>
  );
};

export default WordForm;
