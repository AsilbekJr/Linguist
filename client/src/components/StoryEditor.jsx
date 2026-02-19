import React, { useState } from 'react';

const StoryEditor = ({ words }) => {
  const [story, setStory] = useState('');
  const [title, setTitle] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(false);

  // Filter only mastered or learning words to suggest
  const targetWords = words.map(w => w.word);

  const handleAnalyze = async () => {
    if (!story.trim()) return;
    setLoading(true);
    setFeedback(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
      const res = await fetch(`${API_URL}/api/stories/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            story, 
            targetWords 
        })
      });
      
      const data = await res.json();
      setFeedback(data);
    } catch (err) {
      console.error("Analysis failed:", err);
      // Mock feedback for dev if server fails
      setFeedback({
          vibeScore: 85,
          tone: "Reflective & Melancholic",
          suggestions: [
              "Great use of 'ephemeral'!",
              "Consider using 'serendipitous' instead of 'lucky' to match the vibe."
          ],
          correctedStory: story // simplistic mock
      });
    } finally {
      setLoading(false);
    }
  };

  // Speech-to-Text Setup
  const handleDictate = () => {
    if (!('webkitSpeechRecognition' in window)) {
        alert("Your browser doesn't support speech recognition. Try Chrome.");
        return;
    }
    
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => alert("Listening... Speak now! 🎤");
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setStory(prev => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onerror = (event) => console.error("Speech error:", event.error);
    
    recognition.start();
  };

  // Text-to-Speech Setup
  const handleListen = () => {
    if (!story.trim()) return;
    
    const utterance = new SpeechSynthesisUtterance(story);
    utterance.lang = 'en-US';
    utterance.rate = 0.9; // Slightly slower for learning
    utterance.pitch = 1.1; // Slightly higher for clarity
    
    window.speechSynthesis.cancel(); // Stop previous
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: Writing Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl">
             <h2 className="text-2xl font-bold mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-3xl">✍️ <span className="text-xl text-white">Vibe-Writing</span></span>
              <div className="flex gap-2">
                 <button 
                    onClick={handleDictate}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xl transition-all"
                    title="Dictate (Speech-to-Text)"
                 >
                    🎤
                 </button>
                 <button 
                    onClick={handleListen}
                    className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xl transition-all"
                    title="Listen (Text-to-Speech)"
                 >
                    🔊
                 </button>
              </div>
            </h2>
            
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your flow a title..."
              className="w-full bg-transparent text-2xl font-bold text-white placeholder-gray-600 outline-none mb-4 border-b border-gray-700 focus:border-purple-500 pb-2 transition-all"
            />

            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="Write a short story using your vocabulary... or click 🎤 to speak!"
              className="w-full h-64 bg-gray-900/50 text-gray-200 p-4 rounded-xl border border-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none leading-relaxed text-lg"
            />
            
            <div className="mt-4 flex justify-between items-center">
              <span className="text-gray-500 text-sm">
                {story.trim().split(/\s+/).filter(w => w).length} words
              </span>
              <button
                onClick={handleAnalyze}
                disabled={loading || !story.trim()}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-8 py-3 rounded-xl font-bold transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20"
              >
                {loading ? 'Analyzing Vibe...' : 'Check Vibe ✨'}
              </button>
            </div>
          </div>

          {/* Feedback Section */}
          {feedback && (
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border border-purple-500/30 animate-fade-in">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">AI Feedback</h3>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-gray-900 px-4 py-2 rounded-full border border-gray-700">
                        <span className="text-gray-400 text-sm">Vibe Score</span>
                        <span className={`text-xl font-black ${feedback.vibeScore > 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {feedback.vibeScore}/100
                        </span>
                    </div>
                </div>
              </div>

              <div className="space-y-6 mb-6">
                <div>
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Tone Analysis</h4>
                  <p className="text-purple-300 text-lg">{feedback.tone}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Suggestions</h4>
                  <ul className="space-y-3">
                    {feedback.suggestions.map((sug, i) => (
                      <li key={i} className="flex gap-3 text-gray-300 bg-gray-800/50 p-3 rounded-lg border border-gray-700/50">
                        <span className="text-purple-500">💡</span>
                        {sug}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              <button 
                onClick={() => {
                   const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
                   fetch(`${API_URL}/api/stories`, {
                       method: 'POST',
                       headers: { 'Content-Type': 'application/json' },
                       body: JSON.stringify({
                           title,
                           content: story,
                           wordsUsed: targetWords.filter(w => story.toLowerCase().includes(w.toLowerCase())),
                           vibeScore: feedback.vibeScore,
                           analysis: feedback
                       })
                   }).then(() => alert("Story Saved to Library! (Mock)"));
                }}
                className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/50 py-3 rounded-xl font-bold transition-all"
              >
                  💾 Save to Library
              </button>
            </div>
          )}
        </div>

        {/* Right: Sidebar / Target Words */}
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-gray-300">Target Words</h3>
            <div className="flex flex-wrap gap-2">
              {targetWords.length > 0 ? (
                targetWords.map((word, i) => (
                  <span key={i} className="px-3 py-1 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-400">
                    {word}
                  </span>
                ))
              ) : (
                <p className="text-gray-500 text-sm">Add words to your ecosystem first!</p>
              )}
            </div>
          </div>
          
          <div className="bg-blue-900/20 rounded-2xl p-6 border border-blue-500/20">
             <h4 className="font-bold text-blue-400 mb-2">Daily Prompt</h4>
             <p className="text-gray-300 italic">
               "Write about a time you found something valuable by accident."
             </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default StoryEditor;
