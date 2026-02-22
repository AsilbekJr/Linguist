import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, AlertTriangle } from "lucide-react";

const WordForm = ({ onAddWord }) => {
  const [word, setWord] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showForceSave, setShowForceSave] = useState(false);
  const [manualDefinition, setManualDefinition] = useState('');
  const [manualExample, setManualExample] = useState('');
  const [manualTranslation, setManualTranslation] = useState('');

  const handleSubmit = async (e, skipAI = false) => {
    if (e) e.preventDefault();
    if (!word.trim()) return;

    setLoading(true);
    setError(null);
    setSuggestions([]);
    setShowForceSave(false);

    try {
      await onAddWord(word, skipAI, { manualDefinition, manualExample, manualTranslation });
      setWord('');
      setManualDefinition('');
      setManualExample('');
      setManualTranslation('');
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
    <div className="w-full max-w-2xl mx-auto mb-12 px-4 md:px-0">
        <form onSubmit={(e) => handleSubmit(e, false)} className="relative w-full">
        <div className="relative flex items-center gap-2">
            <Input
              type="text"
              value={word}
              onChange={(e) => {
                  setWord(e.target.value);
                  setError(null);
                  setShowForceSave(false);
              }}
              placeholder="Type a word to add to your ecosystem..."
              className={`bg-background/50 backdrop-blur-sm text-base md:text-lg h-12 md:h-14 pl-6 pr-32 rounded-full border-border focus-visible:ring-primary/20 transition-all placeholder:text-muted-foreground placeholder:text-sm md:placeholder:text-base shadow-lg ${error ? 'border-destructive ring-destructive/20' : ''}`}
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading || !word.trim()}
              size="lg"
              className="absolute right-1 top-1 bottom-1 rounded-full px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-medium transition-all disabled:opacity-50"
            >
            {loading ? (
                <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Stats
                </span>
            ) : (
                <span className="flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Add
                </span>
            )}
            </Button>
        </div>
        
        {error && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive/30 rounded-xl animate-accordion-down">
                <p className="text-destructive flex items-center gap-2 text-sm font-medium">
                    <AlertTriangle className="w-4 h-4" /> {error}
                </p>
                
                {showForceSave && (
                    <div className="mt-4 flex flex-col gap-3">
                         <p className="text-muted-foreground text-xs font-medium">Add details manually to save without AI:</p>
                         <Input
                            type="text"
                            value={manualDefinition}
                            onChange={(e) => setManualDefinition(e.target.value)}
                            placeholder="Definition (e.g., A sweet fruit)"
                            className="bg-background"
                            disabled={loading}
                         />
                         <Input
                            type="text"
                            value={manualExample}
                            onChange={(e) => setManualExample(e.target.value)}
                            placeholder="Example sentence (e.g., I ate an apple)"
                            className="bg-background"
                            disabled={loading}
                         />
                         <Input
                            type="text"
                            value={manualTranslation}
                            onChange={(e) => setManualTranslation(e.target.value)}
                            placeholder="Translation (e.g., Olma)"
                            className="bg-background"
                            disabled={loading}
                         />
                         <Button 
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={!manualDefinition.trim()}
                            onClick={() => handleSubmit(null, true)}
                            className="w-full mt-2"
                         >
                             Save Manually
                         </Button>
                    </div>
                )}

                {suggestions.length > 0 && (
                    <div className="mt-3">
                        <p className="text-xs text-muted-foreground mb-2">Did you mean:</p>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.map((s, i) => (
                                <Button
                                    key={i}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSuggestionClick(s)}
                                    className="h-7 text-xs border-primary/20 text-primary hover:bg-primary/10"
                                >
                                    {s}
                                </Button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

        {!error && (
            <p className="text-center text-muted-foreground text-xs mt-3 flex items-center justify-center gap-1">
                <span className="w-1 h-1 bg-primary rounded-full"></span>
                Enter a word, and AI will generate context, stories, and connections.
            </p>
        )}
        </form>
    </div>
  );
};

export default WordForm;
