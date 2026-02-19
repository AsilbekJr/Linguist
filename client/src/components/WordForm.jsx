import React, { useState } from 'react';

const WordForm = ({ onAddWord }) => {
  const [word, setWord] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!word.trim()) return;

    setLoading(true);
    // Simulate API call for now or pass to parent
    await onAddWord(word);
    setWord('');
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="mb-12 relative w-full max-w-2xl mx-auto">
      <div className="relative flex items-center">
        <input
          type="text"
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="Type a word to add to your ecosystem..."
          className="w-full bg-gray-800/50 backdrop-blur-sm text-white text-lg px-6 py-4 rounded-full border border-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-gray-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Analyzing...' : 'Add Word'}
        </button>
      </div>
      <p className="text-center text-gray-500 text-sm mt-3">
        Enter a word, and AI will generate context, stories, and connections.
      </p>
    </form>
  );
};

export default WordForm;
