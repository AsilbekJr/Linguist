import React, { useState, useEffect } from 'react';

const StoryLibrary = () => {
    const [stories, setStories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
        fetch(`${API_URL}/api/stories`)
            .then(res => res.json())
            .then(data => {
                setStories(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load stories:", err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="text-center text-gray-400 py-10">Loading your universe...</div>;

    return (
        <div className="max-w-4xl mx-auto animate-fade-in-up">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                📚 <span>Your Story Archive</span>
            </h2>

            {stories.length === 0 ? (
                <div className="text-center bg-gray-900/50 p-12 rounded-2xl border border-gray-800 border-dashed">
                    <p className="text-xl text-gray-500">No stories found yet.</p>
                    <p className="text-gray-600 mt-2">Go to Story Mode and let your imagination flow!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {stories.map(story => (
                        <div key={story._id} className="bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-900/20 group">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
                                        {story.title || "Untitled Flow"}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {new Date(story.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                                    story.vibeScore > 80 
                                    ? 'bg-green-500/20 text-green-400 border-green-500/30' 
                                    : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                                }`}>
                                    Vibe: {story.vibeScore}
                                </div>
                            </div>
                            
                            <p className="text-gray-400 text-sm line-clamp-3 mb-4 font-serif leading-relaxed italic">
                                "{story.content}"
                            </p>

                            <div className="flex flex-wrap gap-2">
                                {story.wordsUsed && story.wordsUsed.map((word, i) => (
                                    <span key={i} className="text-xs bg-gray-900 text-gray-400 px-2 py-1 rounded border border-gray-800">
                                        {word}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StoryLibrary;
