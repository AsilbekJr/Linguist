import React, { useState, useEffect, useRef } from 'react';
import { useGetCurrentChallengeQuery, useGetChallengeHistoryQuery, useCompleteChallengeMutation } from '../features/api/apiSlice';
import { Button } from "@/components/ui/button";
import { Mic, Square, Play, Send, Loader2, CheckCircle2, PlusCircle, X, Volume2 } from "lucide-react";
import { playTTSAudio } from '../utils/audio';

const ChallengeMode = ({ onAddWord }) => {
  const { data: history, isLoading: isHistoryLoading, refetch: refetchHistory } = useGetChallengeHistoryQuery();
  const { data: currentChallenge, isLoading: isCurrentLoading, refetch: refetchCurrent } = useGetCurrentChallengeQuery();
  const [completeChallenge, { isLoading: isCompleting }] = useCompleteChallengeMutation();

  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBase64, setAudioBase64] = useState(null);
  const [spokenText, setSpokenText] = useState("");
  const recognitionRef = useRef(null);
  const [error, setError] = useState("");
  const [selectedWord, setSelectedWord] = useState(null);
  const [addWordSuccess, setAddWordSuccess] = useState(false);
  const [isAddingWord, setIsAddingWord] = useState(false);

  const playPronunciation = (text) => {
    playTTSAudio(text, 'en-US', 1.0);
  };

  const playChallengeAudio = (text) => {
    playTTSAudio(text, 'en-US', 0.85);
  };

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Convert blob to base64 for database
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          setAudioBase64(reader.result);
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError("");
      setSpokenText("");

      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'en-US';

          rec.onresult = (event) => {
              let trans = '';
              for (let i = 0; i < event.results.length; ++i) {
                  trans += event.results[i][0].transcript;
              }
              setSpokenText(trans);
          };
          
          recognitionRef.current = rec;
          try {
              rec.start();
          } catch(e) {
              console.warn("Speech API start error", e);
          }
      }

    } catch (err) {
      console.error("Error accessing microphone:", err);
      setError("Mikrofonga ulanishda xatolik. Ruxsat berilganligini tekshiring.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      // Stop all tracks to release microphone
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      
      if (recognitionRef.current) {
          try {
              recognitionRef.current.stop();
          } catch(e) {}
      }
    }
  };

  const handleSubmit = async () => {
    if (!audioBase64 || !currentChallenge) return;

    try {
      await completeChallenge({ 
        challengeId: currentChallenge._id, 
        audioData: audioBase64,
        spokenText: spokenText
      }).unwrap();
      
      setAudioUrl(null);
      setAudioBase64(null);
      setSpokenText("");
      refetchHistory();
      refetchCurrent();
    } catch (err) {
      setError("Saqlashda xatolik yuz berdi. Iltimos qayta urinib ko'ring.");
    }
  };

  const handleQuickAddWord = async () => {
    if (!selectedWord) return;
    setIsAddingWord(true);
    try {
      await onAddWord(selectedWord, false);
      setAddWordSuccess(true);
      setTimeout(() => {
        setAddWordSuccess(false);
        setSelectedWord(null);
      }, 2000);
    } catch (err) {
      let errorMessage = "So'zni qo'shishda xatolik yuz berdi. Internetni tekshiring.";
      if (err && err.type === 'DUPLICATE') {
          errorMessage = err.message || "Bu so'z allaqachon lug'atingizda bor.";
      } else if (err && err.type === 'QUOTA_EXCEEDED') {
          errorMessage = "AI band. Iltimos keyinroq urinib ko'ring yoki Word Lab orqali qo'lda qo'shing.";
      }
      setError(errorMessage);
    } finally {
      setIsAddingWord(false);
    }
  };

  // Render Progress Bar instead of 100 Days Grid
  const renderProgressBar = () => {
    if (isHistoryLoading) return <div className="text-center py-6"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>;
    
    let completedCount = 0;
    if (history) {
      completedCount = history.filter(h => h.status === 'completed').length;
    }
    
    // Ensure it doesn't exceed 100
    const percentage = Math.min(100, Math.round((completedCount / 100) * 100));

    return (
      <div className="mb-8 md:mb-12 max-w-2xl mx-auto bg-card p-4 sm:p-6 rounded-3xl border shadow-sm">
        <div className="flex justify-between items-center mb-3">
           <h3 className="font-bold text-foreground">Sizning Natijangiz</h3>
           <span className="text-sm font-black bg-primary/10 text-primary px-3 py-1 rounded-full">{percentage}% Bajarildi</span>
        </div>
        
        <div className="w-full bg-secondary/50 rounded-full h-4 md:h-5 overflow-hidden border border-border/50">
           <div 
             className="bg-gradient-to-r from-emerald-400 to-cyan-500 h-full rounded-full transition-all duration-1000 ease-out relative"
             style={{ width: `${percentage}%` }}
           >
              {percentage > 0 && (
                 <div className="absolute top-0 right-0 bottom-0 w-10 bg-gradient-to-l from-white/30 to-transparent"></div>
              )}
           </div>
        </div>
        
        <p className="text-xs text-muted-foreground mt-3 font-medium text-center">
            {100 - completedCount} kun qoldi. Bo'shashmang! 🚀
        </p>
      </div>
    );
  };

  // Convert text with markdown asterisks to JSX highlighting, making every word clickable
  const renderTextContent = (text) => {
    if (!text) return null;
    
    // Split text by boundaries (spaces or newlines) to process word by word
    const wordsAndSpaces = text.split(/(\s+)/);
    
    return wordsAndSpaces.map((segment, i) => {
      // If it's just whitespace, return as is
      if (/^\s+$/.test(segment)) {
        return <span key={i}>{segment}</span>;
      }
      
      let isTarget = false;
      let cleanWord = segment;
      
      if (cleanWord.startsWith('**') && cleanWord.endsWith('**')) {
        isTarget = true;
        cleanWord = cleanWord.substring(2, cleanWord.length - 2);
      }
      
      // Strip punctuation for the word to save
      const wordToSave = cleanWord.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").trim();

      return (
        <span 
          key={i}
          onClick={() => {
            if (wordToSave.length > 0) setSelectedWord(wordToSave);
          }}
          className={`cursor-pointer transition-colors ${
            isTarget 
              ? 'text-primary font-black bg-primary/10 px-1 rounded mx-0.5 hover:bg-primary/20' 
              : 'hover:bg-muted-foreground/20 hover:text-primary rounded px-0.5'
          }`}
          title="Lug'atga qo'shish uchun bosing"
        >
          {cleanWord}
        </span>
      );
    });
  };

  if (isCurrentLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
         <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
         <p className="text-muted-foreground font-medium">Bugungi mashg'ulot yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-emerald-400 to-cyan-500 bg-clip-text text-transparent mb-4">
          100 Days Challenge 🎯
        </h2>
        <p className="text-base md:text-lg text-muted-foreground">
          Har kuni berilgan matnni yodlang va yoddan aytib yozib qoldiring. Izchillik - muvaffaqiyat kaliti!
        </p>
      </div>

      {renderProgressBar()}

      {currentChallenge && currentChallenge.isFinished ? (
         <div className="text-center bg-card p-4 sm:p-6 md:p-12 rounded-3xl border-2 border-green-500/30">
             <div className="text-6xl mb-6">🏆</div>
             <h3 className="text-3xl font-black text-foreground mb-4">Tabriklaymiz!</h3>
             <p className="text-xl text-muted-foreground">Siz 100 kunlik challenge'ni muvaffaqiyatli yakunladingiz!</p>
         </div>
      ) : currentChallenge && currentChallenge.isCompleteForToday ? (
        <div className="text-center bg-card p-4 sm:p-6 md:p-12 rounded-3xl border border-border shadow-sm">
             <div className="text-6xl mb-6">✅</div>
             <h3 className="text-2xl font-bold text-foreground mb-2">Bugungi vazifa bajarildi!</h3>
             <p className="text-muted-foreground">Ertaga yangi matn bilan qayting. Xotirjam dam oling!</p>
             
             {currentChallenge.lastChallenge && currentChallenge.lastChallenge.audioData && (
                 <div className="mt-8">
                     <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">Bugungi yozuvingiz</p>
                     <audio src={currentChallenge.lastChallenge.audioData} controls className="mx-auto w-full max-w-md rounded-2xl mb-6" />
                     
                     {currentChallenge.lastChallenge.score !== null && currentChallenge.lastChallenge.score !== undefined && (
                         <div className={`mt-6 p-4 sm:p-6 rounded-2xl border text-left border-${currentChallenge.lastChallenge.color}-200 bg-${currentChallenge.lastChallenge.color}-50 dark:bg-card dark:border-border`}>
                             <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl">
                                    {currentChallenge.lastChallenge.score >= 90 ? '🔥' : currentChallenge.lastChallenge.score >= 50 ? '💪' : '📚'}
                                </span>
                                <h4 className="font-bold text-lg text-foreground">AI Baholashi: {currentChallenge.lastChallenge.score}/100</h4>
                             </div>
                             <p className="text-muted-foreground text-sm leading-relaxed">{currentChallenge.lastChallenge.feedback}</p>
                         </div>
                     )}
                 </div>
             )}
         </div>
      ) : currentChallenge ? (
        <div className="bg-card rounded-2xl md:rounded-3xl p-4 sm:p-6 md:p-10 border border-border shadow-md">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <span className="bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold shrink-0">
                        Day {currentChallenge.dayNumber}
                    </span>
                    <span className="text-muted-foreground text-sm font-medium">
                        {currentChallenge.topic}
                    </span>
                </div>
                <Button size="sm" onClick={() => playChallengeAudio(currentChallenge.text)} className="rounded-full bg-blue-500 hover:bg-blue-600 text-white w-full sm:w-auto">
                    <Volume2 className="w-4 h-4 mr-2" /> Eshitish
                </Button>
            </div>
            
            <div className="bg-background rounded-2xl p-4 sm:p-6 md:p-8 mb-6 md:mb-8 border border-border">
                <p className="text-lg md:text-xl leading-relaxed text-card-foreground">
                    {renderTextContent(currentChallenge.text)}
                </p>
            </div>

            {selectedWord && (
                <div className="mb-6 md:mb-8 p-4 sm:p-6 bg-secondary/30 rounded-2xl border border-primary/20 animate-fade-in-up">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-bold text-lg">Lug'atga qo'shish</h4>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedWord(null); setAddWordSuccess(false); }} className="h-8 w-8 p-0">
                           <X className="w-5 h-5 text-muted-foreground" />
                        </Button>
                    </div>
                    
                    <div className="bg-background p-4 sm:p-6 rounded-xl border flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left overflow-hidden">
                        {addWordSuccess ? (
                           <div className="flex items-center text-green-500 font-bold gap-2 w-full justify-center">
                               <CheckCircle2 className="w-6 h-6" />
                               "{selectedWord}" Word Lab'ga muvaffaqiyatli qo'shildi! AI uni avtomatik tarjima qildi.
                           </div>
                        ) : (
                           <>
                             <div>
                                 <p className="text-base text-card-foreground font-medium"> 
                                     <strong className="text-primary text-xl">"{selectedWord}"</strong> so'zini lug'atingizga qo'shmoqchimisiz?
                                 </p>
                                 <p className="text-sm text-muted-foreground mt-1">AI avtomatik tarzda tarjima, ta'rif va misollarni topadi.</p>
                             </div>
                             <div className="flex flex-wrap sm:flex-nowrap justify-center sm:justify-end w-full sm:w-auto gap-2 sm:gap-3 mt-4 sm:mt-0">
                                 <Button variant="secondary" onClick={() => playPronunciation(selectedWord)} title="Tinglash (UK)" className="flex-1 sm:flex-none">
                                     <Volume2 className="w-4 h-4 mr-2 shrink-0" /> Tinglash
                                 </Button>
                                 <Button variant="outline" onClick={() => setSelectedWord(null)} className="flex-1 sm:flex-none">Yo'q</Button>
                                 <Button onClick={handleQuickAddWord} disabled={isAddingWord} className="min-w-[100px] text-white flex-1 sm:flex-none w-full sm:w-auto mt-2 sm:mt-0">
                                     {isAddingWord ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <><PlusCircle className="w-4 h-4 mr-2 text-white" /> Qo'shish</>}
                                 </Button>
                             </div>
                           </>
                        )}
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-destructive/10 text-destructive text-sm font-bold p-3 rounded-xl text-center mb-6">
                    {error}
                </div>
            )}

            <div className="flex flex-col items-center justify-center gap-6">
                {!audioUrl ? (
                    <div className="flex flex-col items-center gap-4">
                        <Button 
                            onClick={isRecording ? stopRecording : startRecording}
                            size="lg"
                            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full transition-all duration-300 ${isRecording ? 'bg-destructive hover:bg-destructive/90 animate-pulse ring-8 ring-destructive/20' : 'bg-primary hover:bg-primary/90 hover:scale-105 shadow-xl shadow-primary/20'}`}
                        >
                            {isRecording ? <Square className="w-6 h-6 sm:w-8 sm:h-8 text-white" /> : <Mic className="w-6 h-6 sm:w-8 sm:h-8 text-white" />}
                        </Button>
                        <p className="text-sm font-medium text-muted-foreground">
                            {isRecording ? 'Yozib olinmoqda... To\'xtatish uchun bosing' : 'Yoddan aytishni boshlash uchun bosing'}
                        </p>
                    </div>
                ) : (
                    <div className="w-full flex justify-center mt-4">
                        <div className="flex flex-col items-center gap-6 w-full max-w-md bg-secondary/30 p-4 sm:p-6 border rounded-3xl">
                             <audio src={audioUrl} controls className="w-full rounded-2xl" />
                             <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-4 w-full">
                                 <Button variant="outline" className="flex-1 w-full rounded-full" onClick={() => setAudioUrl(null)}>
                                     Qayta Yozish
                                 </Button>
                                 <Button className="flex-1 w-full rounded-full bg-green-500 hover:bg-green-600 text-white" onClick={handleSubmit} disabled={isCompleting}>
                                     {isCompleting ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <><Send className="w-4 h-4 mr-2 text-white" /> Jo'natish</>}
                                 </Button>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      ) : (
        <div className="text-center p-6 sm:p-12">Nimadir xato ketdi. Sahifani yangilab ko'ring.</div>
      )}
    </div>
  );
};

export default ChallengeMode;
