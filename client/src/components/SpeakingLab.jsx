import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, Sparkles, Loader2, RefreshCw } from "lucide-react";

const SpeakingLab = () => {
  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
  
  const [isListening, setIsListening] = useState(false);
  const [uzbekText, setUzbekText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translations, setTranslations] = useState(null); // { casual: '', advanced: '' }
  const [error, setError] = useState("");
  const [recognition, setRecognition] = useState(null);

  // Initialize Web Speech API
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'uz-UZ'; // Listen in Uzbek

      rec.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        const currentText = finalTranscript || interimTranscript;
        setUzbekText(currentText);
      };

      rec.onend = () => {
        setIsListening(false);
        // If we stopped listening and have text, trigger AI translation
        setUzbekText((currentText) => {
            if (currentText.trim().length > 2) {
                 handleTranslation(currentText);
            }
            return currentText;
        });
      };

      rec.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
        setError("Mikrofonda muammo yuz berdi. Iltimos tekshiring.");
      };

      setRecognition(rec);
    } else {
      setError("Sizning brauzeringiz Speech API ni qo'llab-quvvatlamaydi. Iltimos Google Chromedan foydalaning.");
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognition.stop();
    } else {
      setUzbekText("");
      setTranslations(null);
      setError("");
      recognition.start();
      setIsListening(true);
    }
  };

  const handleTranslation = async (textToTranslate) => {
      setIsTranslating(true);
      setError("");
      
      try {
          const res = await fetch(`${API_URL}/api/speaking/translate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: textToTranslate })
          });

          if (!res.ok) throw new Error("Tarjima qilib bo'lmadi.");
          
          const data = await res.json();
          setTranslations(data);
      } catch (err) {
          console.error(err);
          setError("Tarjimada xatolik yuz berdi. Internetni tekshiring.");
      } finally {
          setIsTranslating(false);
      }
  };

  const playAudio = (text) => {
      if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel(); // Stop any currently playing audio
          const msg = new SpeechSynthesisUtterance(text);
          msg.lang = 'en-US';
          msg.rate = 0.9; // Slightly slower for clear learning
          window.speechSynthesis.speak(msg);
      } else {
          setError("Brauzerda ovozni o'qish imkoniyati yo'q.");
      }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up py-8 px-4">
      <div className="text-center mb-12">
        <h2 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent mb-4">
          Speaking Lab
        </h2>
        <p className="text-muted-foreground text-lg">
          O'zbek tilida bemalol gapiring, tizim sizga uning Inglizcha mukammal ekvivalentini oydinlashtirib beradi.
        </p>
      </div>

      {error && (
         <div className="bg-destructive/10 border border-destructive/30 text-destructive p-4 rounded-xl mb-8 text-center animate-pulse">
             {error}
         </div>
      )}

      {/* STAGE 1: Listening AI */}
      <div className={`relative bg-card rounded-3xl p-8 border text-center transition-all duration-500 mb-8 ${isListening ? 'border-orange-500/50 shadow-lg shadow-orange-500/20' : 'border-border'}`}>
          <div className="mb-8">
              <Button
                 onClick={toggleListening}
                 size="lg"
                 className={`w-24 h-24 rounded-full transition-all duration-300 ${isListening ? 'bg-destructive hover:bg-destructive/90 animate-pulse ring-8 ring-destructive/20' : 'bg-primary hover:bg-primary/90 hover:scale-105'}`}
              >
                  {isListening ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
              </Button>
          </div>

          <div className="min-h-[100px] flex flex-col justify-center items-center">
              {!isListening && !uzbekText && (
                  <p className="text-muted-foreground text-lg italic">
                      Mikrofonni bosing va O'zbek tilida biron gap ayting...
                  </p>
              )}
              
              {isListening && !uzbekText && (
                   <p className="text-orange-500 font-medium animate-pulse">Eshitmoqdaman...</p>
              )}

              {uzbekText && (
                  <h3 className="text-2xl font-bold text-card-foreground">
                      "{uzbekText}"
                  </h3>
              )}
          </div>
      </div>

      {/* STAGE 2: AI Translations & Synthesis */}
      {isTranslating && (
          <div className="flex flex-col items-center justify-center p-12 bg-card rounded-3xl border border-border mt-8">
              <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground font-medium">Ingliz tiliga mukammal tarjima qilinmoqda...</p>
          </div>
      )}

      {!isTranslating && translations && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8 animate-fade-in">
              {/* Casual Version */}
              <div className="bg-background rounded-3xl p-6 border border-border hover:border-blue-500/50 transition-colors shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Sparkles className="w-24 h-24 text-blue-500" />
                  </div>
                  <div className="flex justify-between items-start mb-4">
                      <div>
                          <h4 className="font-bold text-blue-500 text-lg">Kundalik (Casual)</h4>
                          <p className="text-xs text-muted-foreground">Sodda ommabop tarjima</p>
                      </div>
                      <Button 
                          variant="secondary" 
                          size="icon" 
                          onClick={() => playAudio(translations.casual)}
                          className="rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-all z-10"
                      >
                          <Volume2 className="w-5 h-5" />
                      </Button>
                  </div>
                  <p className="text-2xl font-black text-card-foreground leading-snug z-10 relative">
                     {translations.casual}
                  </p>
              </div>

              {/* Advanced Version */}
              <div className="bg-background rounded-3xl p-6 border border-border hover:border-purple-500/50 transition-colors shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Sparkles className="w-24 h-24 text-purple-500" />
                  </div>
                  <div className="flex justify-between items-start mb-4">
                      <div>
                          <h4 className="font-bold text-purple-500 text-lg">Boyitilgan (Advanced)</h4>
                          <p className="text-xs text-muted-foreground">Keng lug'at boyligi bilan</p>
                      </div>
                      <Button 
                          variant="secondary" 
                          size="icon" 
                          onClick={() => playAudio(translations.advanced)}
                          className="rounded-full bg-purple-500/10 text-purple-500 hover:bg-purple-500 hover:text-white transition-all z-10"
                      >
                          <Volume2 className="w-5 h-5" />
                      </Button>
                  </div>
                  <p className="text-2xl font-black text-card-foreground leading-snug z-10 relative">
                     {translations.advanced}
                  </p>
              </div>
          </div>
      )}
      
      {translations && !isTranslating && (
          <div className="mt-8 flex justify-center">
             <Button variant="outline" onClick={() => { setUzbekText(""); setTranslations(null); }} className="rounded-full">
                 <RefreshCw className="w-4 h-4 mr-2" /> Yangi gap tuzish
             </Button>
          </div>
      )}
    </div>
  );
};

export default SpeakingLab;
