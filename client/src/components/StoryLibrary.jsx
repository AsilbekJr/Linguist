import React from 'react';
import { useGetStoriesQuery } from '../features/api/apiSlice';

const StoryLibrary = () => {
    const { data: stories = [], isLoading: loading, isError } = useGetStoriesQuery();

    if (loading) return <div className="text-center text-muted-foreground py-10">Loading your universe...</div>;
    if (isError) return <div className="text-center text-destructive py-10">Failed to load stories.</div>;

    return (
        <div className="max-w-4xl mx-auto animate-fade-in-up">
            <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                📚 <span>Your Story Archive</span>
            </h2>

            {stories.length === 0 ? (
                <div className="text-center bg-muted/20 p-12 rounded-2xl border border-border border-dashed">
                    <p className="text-xl text-muted-foreground">No stories found yet.</p>
                    <p className="text-muted-foreground mt-2">Go to Story Mode and let your imagination flow!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {stories.map(story => (
                        <div key={story._id} className="bg-card rounded-xl p-6 border border-border hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/10 group">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-card-foreground group-hover:text-primary transition-colors">
                                        {story.title || "Untitled Flow"}
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-1">
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
                            
                            <p className="text-muted-foreground text-sm line-clamp-3 mb-4 font-serif leading-relaxed italic">
                                "{story.content}"
                            </p>

                            <div className="flex flex-wrap gap-2">
                                {story.wordsUsed && story.wordsUsed.map((word, i) => (
                                    <span key={i} className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded border border-border">
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
