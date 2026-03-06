import React from 'react';
import { 
  useGetCurrentTopicQuery, 
  useCompleteTopicMutation, 
  useAddWordMutation,
  useSyncDailyQuestMutation,
  useGetWordsQuery
} from '../features/api/apiSlice';
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, BookOpen, Volume2, PlusCircle, ArrowRight } from "lucide-react";
import { toast } from "react-hot-toast";
import { playTTSAudio } from '../utils/audio';

const TopicVocabulary = () => {
    const { data: topicData, isLoading, refetch } = useGetCurrentTopicQuery();
    const [completeTopic, { isLoading: isCompleting }] = useCompleteTopicMutation();
    const [addWord] = useAddWordMutation();
    const [syncDailyQuest] = useSyncDailyQuestMutation();
    const { data: userWords = [] } = useGetWordsQuery();

    const [addingWords, setAddingWords] = React.useState({});
    const [addedWords, setAddedWords] = React.useState({});



    const playPronunciation = (wordText) => {
        playTTSAudio(wordText, 'en-GB', 1.0);
    };

    const handleAddWordToDict = async (wordObj) => {
        setAddingWords(prev => ({ ...prev, [wordObj.word]: true }));

        try {
             // Create standard payload for the word lab
             const payload = {
                word: wordObj.word,
                skipAI: true,
                manualTranslation: wordObj.translation,
                manualDefinition: wordObj.definition,
                manualExamples: [wordObj.example],
                partOfSpeech: wordObj.partOfSpeech,
                synonyms: [] // basic fallback 
             };

             await addWord(payload).unwrap();
             setAddedWords(prev => ({ ...prev, [wordObj.word]: true }));
             toast.success(`"${wordObj.word}" lug'atingizga qo'shildi!`);
             
             // Refresh the list after short delay so user sees animation
             setTimeout(() => {
                 refetch();
             }, 800);

             // Auto complete daily quest if 5 words added or it's the very last word on the screen
             const currentAddedCount = topicData?.words?.filter(w => 
                 userWords.some(uw => uw.word.toLowerCase() === w.word.toLowerCase())
             ).length || 0;
             
             if (currentAddedCount + 1 >= 5 || topicData?.words?.length <= 1) {
                 try {
                     const res = await syncDailyQuest({ type: 'topic' }).unwrap();
                     if (!topicData.isCompleteForToday) {
                          await completeTopic().unwrap();
                     }
                     if (res.streakUpdated) {
                         toast.success(res.message, { icon: '🔥' });
                     } else {
                         toast.success("🔥 Yangi Qon vazifasi bajarildi!");
                     }
                 } catch (sqErr) {
                     console.error("Failed to sync daily quest automatically", sqErr);
                 }
             }
        } catch (error) {
             let errorMessage = "So'zni qo'shishda xatolik yuz berdi.";
             if (error && error.data && error.data.error === "Bu so'z allaqachon lug'atingizga qo'shilgan!") {
                 errorMessage = "Bu so'z allaqachon lug'atingizda bor.";
                 setAddedWords(prev => ({ ...prev, [wordObj.word]: true }));
             }
             toast.error(errorMessage);
        } finally {
            setAddingWords(prev => ({ ...prev, [wordObj.word]: false }));
        }
    };



    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
               <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
               <p className="text-muted-foreground font-medium">Bugungi lug'at yuklanmoqda...</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
            <div className="text-center mb-10">
                <h2 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-4">
                  Daily Topic Vocabulary 📚
                </h2>
                <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
                  Har kuni bitta aniq mavzu doirasida eng kerakli ibora va so'zlarni o'rganing.
                </p>
            </div>



            {topicData && topicData.isFinished ? (
               <div className="text-center bg-card p-4 sm:p-6 md:p-12 rounded-3xl border-2 border-green-500/30">
                   <div className="text-6xl mb-6">🏆</div>
                   <h3 className="text-3xl font-black text-foreground mb-4">Tabriklaymiz!</h3>
                   <p className="text-xl text-muted-foreground">Siz barcha mavzulashtirilgan lug'atlarni o'zlashtirdingiz!</p>
               </div>
            ) : topicData ? (
               <div className="space-y-6">
                   <div className="bg-card rounded-3xl p-4 sm:p-6 md:p-10 border border-border shadow-md relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl"></div>
                       
                       <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b pb-6">
                           <div>
                               <span className="inline-block bg-purple-500/10 text-purple-500 px-4 py-1.5 rounded-full text-sm font-bold mb-3">
                                   {new Date().toLocaleDateString('ru-RU')} (Day {topicData.day})
                               </span>
                               <h1 className="text-3xl font-black">{topicData.topic}</h1>
                               <p className="text-muted-foreground mt-2">{topicData.description}</p>
                           </div>
                       </div>

                       <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                           {topicData.words && topicData.words.length === 0 ? (
                               <div className="col-span-1 md:col-span-2 text-center p-4 sm:p-8 bg-purple-500/5 rounded-2xl border border-purple-500/10">
                                   <div className="text-4xl mb-3">✨</div>
                                   <h3 className="text-xl font-bold text-foreground mb-2">Barcha so'zlar o'zlashtirilgan!</h3>
                                   <p className="text-muted-foreground mb-6">Siz joriy kungacha bo'lgan hamma so'zlarni lug'atingizga saqlab ulgurgansiz.</p>
                                   {!topicData.isCompleteForToday && (
                                       <Button onClick={() => completeTopic()} disabled={isCompleting}>
                                           {isCompleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Bugunni yakunlash
                                       </Button>
                                   )}
                                   {topicData.isCompleteForToday && (
                                       <p className="text-green-500 font-medium">Ertaga yangi so'zlar kutib oling!</p>
                                   )}
                               </div>
                           ) : topicData.words.map((w, index) => {
                               const isAlreadyAdded = userWords.some(userWord => userWord.word.toLowerCase() === w.word.toLowerCase());
                               return (
                               <div key={index} className="bg-background rounded-2xl p-5 border border-border flex flex-col hover:border-purple-500/50 transition-colors group">
                                   <div className="flex justify-between items-start mb-4">
                                       <div>
                                           <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                                               {w.word}
                                               <button onClick={() => playPronunciation(w.word)} className="text-muted-foreground hover:text-purple-500 transition-colors">
                                                   <Volume2 className="w-4 h-4" />
                                               </button>
                                           </h3>
                                           <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-md mt-1 inline-block">
                                               {w.phonetic} • {w.partOfSpeech}
                                           </span>
                                       </div>
                                       
                                       <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          onClick={() => handleAddWordToDict(w)}
                                          disabled={addingWords[w.word] || addedWords[w.word] || isAlreadyAdded}
                                          className={`rounded-full h-8 w-8 p-0 ${(addedWords[w.word] || isAlreadyAdded) ? 'bg-green-500/10 text-green-500' : 'hover:bg-purple-500/10 hover:text-purple-500'}`}
                                          title="Word Lab'ga saqlash"
                                       >
                                           {addingWords[w.word] ? (
                                               <Loader2 className="w-4 h-4 animate-spin" />
                                           ) : (addedWords[w.word] || isAlreadyAdded) ? (
                                               <CheckCircle2 className="w-4 h-4" />
                                           ) : (
                                               <PlusCircle className="w-5 h-5" />
                                           )}
                                       </Button>
                                   </div>

                                   <div className="space-y-3 flex-1">
                                       <div>
                                           <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Defintion</div>
                                           <p className="text-sm font-medium">{w.definition}</p>
                                       </div>
                                       <div className="bg-purple-500/5 p-3 rounded-xl border border-purple-500/10">
                                            <p className="text-sm italic text-foreground w-full">"{w.example}"</p>
                                       </div>
                                       <div className="pt-2 border-t mt-auto">
                                            <p className="text-sm font-bold text-green-600 dark:text-green-400">
                                               {w.translation}
                                            </p>
                                       </div>
                                   </div>
                               </div>
                               );
                           })}
                       </div>


                   </div>
               </div>
            ) : (
               <div className="text-center p-6 sm:p-12">Nimadir xato ketdi. Sahifani yangilab ko'ring.</div>
            )}
        </div>
    );
};

export default TopicVocabulary;
