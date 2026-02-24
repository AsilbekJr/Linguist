import React, { useState, useMemo } from 'react';
import { useGetWordsQuery, useAddWordMutation, useDeleteWordMutation } from '../features/api/apiSlice';
import { groupWordsByDate } from '../utils/dateUtils';
import WordForm from '../components/WordForm';
import WordCard from '../components/WordCard';
import { Calendar, ChevronLeft, Search, PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription, DialogHeader } from "../components/ui/dialog";
import { Button } from "../components/ui/button";

const Vocabulary = () => {
  const { data: words = [], isLoading } = useGetWordsQuery();
  const [addWordMutation] = useAddWordMutation();
  const [deleteWordMutation] = useDeleteWordMutation();

  const [activeDateGroup, setActiveDateGroup] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

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
          setIsAddModalOpen(false); // Close modal on success
      } catch (err) {
          const errorData = err.data || err;
          if (errorData.type === 'DUPLICATE' || errorData.type === 'INVALID' || errorData.type === 'QUOTA_EXCEEDED') {
              throw errorData; 
          }
          throw new Error("Failed to add word.");
      }
  };

  const handleDeleteWord = async (id) => {
      try {
          await deleteWordMutation(id).unwrap();
      } catch (err) {
          console.error("Delete failed:", err);
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
    <div className="max-w-6xl mx-auto animate-fade-in-up">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl md:text-4xl font-black mb-2 flex items-center gap-3">
             📚 Mening Lug'atim
          </h1>
          <p className="text-muted-foreground flex items-center gap-2">
            Umumiy baza: <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">{words.length} ta so'z</span>
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           {/* Add Word Modal Trigger */}
           <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                  <Button size="lg" className="rounded-xl gap-2 font-bold shadow-md hover:shadow-lg transition-all w-full md:w-auto">
                      <PlusCircle className="w-5 h-5" /> Yangi So'z Qo'shish
                  </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl bg-card border-border">
                  <DialogHeader>
                      <DialogTitle className="text-2xl font-black mb-2">Yangi so'z qo'shish</DialogTitle>
                      <DialogDescription>
                          So'zni kiriting, sun'iy intellekt unga ma'no va misollar topib beradi.
                      </DialogDescription>
                  </DialogHeader>
                  <div className="py-6">
                      <WordForm onAddWord={handleAddWord} />
                  </div>
              </DialogContent>
           </Dialog>
        </div>
      </div>

      {/* Global Search Bar */}
      {!activeDateGroup && (
        <div className="relative mb-10 group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
            </div>
            <input 
                type="text" 
                placeholder="Lug'atdan so'z, tarjima yoki ma'no qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-card border-2 border-border focus:border-primary focus:ring-4 focus:ring-primary/20 outline-none transition-all shadow-sm focus:shadow-md text-foreground placeholder:text-muted-foreground text-base md:text-lg"
            />
        </div>
      )}

      {/* Content Area */}
      {searchQuery ? (
          /* GLOBAL SEARCH RESULTS */
          <div className="space-y-6">
              <h3 className="text-xl font-bold text-card-foreground">
                  Qidiruv natijalari: {filteredWords.length} ta
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredWords.map((word) => (
                      <WordCard key={word._id} word={word} onDelete={handleDeleteWord} />
                  ))}
                  {filteredWords.length === 0 && (
                      <div className="col-span-full py-16 text-center text-muted-foreground bg-card border border-dashed border-border rounded-3xl">
                          So'z topilmadi.
                      </div>
                  )}
              </div>
          </div>
      ) : !activeDateGroup ? (
          /* DATE GROUP CARDS VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Object.entries(groupedWords).map(([date, wordsInGroup]) => (
                  <div 
                      key={date} 
                      onClick={() => setActiveDateGroup(date)}
                      className="bg-card rounded-3xl p-6 border border-border shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary/50 transition-all cursor-pointer group flex flex-col items-start"
                  >
                      <div className="w-12 h-12 rounded-2xl bg-secondary border border-border flex items-center justify-center mb-4 group-hover:scale-110 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                          <Calendar className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-bold text-card-foreground mb-1">
                          {date}
                      </h3>
                      <p className="text-muted-foreground text-sm font-medium mb-4">
                          {wordsInGroup.length} ta so'z
                      </p>
                      <div className="mt-auto flex items-center text-primary text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                          Ko'rish &rarr;
                      </div>
                  </div>
              ))}
              {Object.keys(groupedWords).length === 0 && !isLoading && (
                  <div className="col-span-full text-center py-20 bg-card border border-border border-dashed rounded-3xl">
                      <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                          <BookOpen className="w-10 h-10 text-muted-foreground" />
                      </div>
                      <p className="text-xl font-bold text-foreground mb-2">Lug'atingiz bo'sh</p>
                      <p className="text-muted-foreground">Tepadagi tugma orqali birinchi so'zingizni qo'shing!</p>
                  </div>
              )}
          </div>
      ) : (
          /* WORD CARDS IN SELECTED DATE GROUP */
          <div className="animate-fade-in">
              <button 
                  onClick={() => setActiveDateGroup(null)}
                  className="mb-8 text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors font-medium bg-secondary px-4 py-2 rounded-xl hover:bg-secondary/80 w-fit"
              >
                  <ChevronLeft className="w-5 h-5" /> Orqaga
              </button>
              
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-card-foreground flex items-center gap-3">
                    <Calendar className="w-6 h-6 text-primary" /> {activeDateGroup}
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupedWords[activeDateGroup].map((word) => (
                      <WordCard 
                          key={word._id} 
                          word={word} 
                          onDelete={handleDeleteWord}
                      />
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};

export default Vocabulary;
