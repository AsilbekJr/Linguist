import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, Sparkles, Loader2, RefreshCw, AudioLines } from "lucide-react";
import { useTranslateSpeakingMutation, useEvaluateSpeakingMutation } from '../features/api/apiSlice';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { podcastsData } from '../data/podcastsData';

const SpeakingLab = () => {
  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
  
  const [isListening, setIsListening] = useState(false);
  const [uzbekText, setUzbekText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translations, setTranslations] = useState(null); // { casual: '', advanced: '' }
  const [error, setError] = useState("");
  const [uzbekRecognition, setUzbekRecognition] = useState(null);

  // Phase 2 State
  const [isPracticing, setIsPracticing] = useState(false);
  const [practiceType, setPracticeType] = useState(null); // 'casual' or 'advanced'
  const [spokenEnglish, setSpokenEnglish] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationData, setEvaluationData] = useState(null); // { score, feedback, color }
  const [englishRecognition, setEnglishRecognition] = useState(null);

  // RTK Query Mutations
  const [translateSpeaking] = useTranslateSpeakingMutation();
  const [evaluateSpeakingMutation] = useEvaluateSpeakingMutation();

  // Use refs to avoid stale closures in Web Speech API event listeners
  const translationsRef = React.useRef(null);
  const practiceTypeRef = React.useRef(null);
  const spokenEnglishRef = React.useRef("");
  const apiCallRef = React.useRef(null);

  useEffect(() => {
      translationsRef.current = translations;
      practiceTypeRef.current = practiceType;
  }, [translations, practiceType]);

  // We define the evaluate function in a ref so listeners can call the latest version
  useEffect(() => {
      apiCallRef.current = async (spokenRawText, currentPracticeType) => {
          setIsEvaluating(true);
          const currentTranslations = translationsRef.current;
          
          if (!currentTranslations) {
              setIsEvaluating(false);
              return;
          }

          const targetSentence = currentTranslations[currentPracticeType];

          try {
              const data = await evaluateSpeakingMutation({ targetSentence, spokenText: spokenRawText }).unwrap();
              setEvaluationData(data);
          } catch (err) {
              setError("Sun'iy intellekt baholashda xatolik berdi.");
          } finally {
              setIsEvaluating(false);
          }
      };
  });

  // Initialize Web Speech APIs
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      // 1. Uzbek Listener (Phase 1)
      const uzRec = new SpeechRecognition();
      uzRec.continuous = false;
      uzRec.interimResults = true;
      uzRec.lang = 'uz-UZ';

      uzRec.onresult = (event) => {
        let finalTrans = '';
        let interimTrans = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTrans += event.results[i][0].transcript;
          else interimTrans += event.results[i][0].transcript;
        }
        setUzbekText(finalTrans || interimTrans);
      };

      uzRec.onend = () => {
        setIsListening(false);
        setUzbekText((currentText) => {
            if (currentText.trim().length > 2) handleTranslation(currentText);
            return currentText;
        });
      };
      uzRec.onerror = () => { setIsListening(false); setError("O'zbek mikrofoni bilan xatolik."); };
      setUzbekRecognition(uzRec);

      // 2. English Listener (Phase 2)
      const enRec = new SpeechRecognition();
      enRec.continuous = false;
      enRec.interimResults = true;
      enRec.lang = 'en-US';

      enRec.onresult = (event) => {
        let finalTrans = '';
        let interimTrans = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTrans += event.results[i][0].transcript;
          else interimTrans += event.results[i][0].transcript;
        }
        const newText = finalTrans || interimTrans;
        spokenEnglishRef.current = newText;
        setSpokenEnglish(newText);
      };

      enRec.onend = () => {
        setIsPracticing(false);
        const finalSpoken = spokenEnglishRef.current;
        const pt = practiceTypeRef.current;
        
        if (finalSpoken.trim().length > 1 && pt && apiCallRef.current) {
            apiCallRef.current(finalSpoken, pt);
        }
      };
      enRec.onerror = () => { setIsPracticing(false); setError("Ingliz mikrofonida xatolik yuz berdi."); };
      setEnglishRecognition(enRec);
      
    } else {
      setError("Brauzeringiz Speech API ni qo'llab-quvvatlamaydi.");
    }
  }, []);

  const toggleUzbekListening = () => {
    if (isListening) uzbekRecognition.stop();
    else {
      setUzbekText("");
      setTranslations(null);
      setSpokenEnglish("");
      setEvaluationData(null);
      setError("");
      uzbekRecognition.start();
      setIsListening(true);
    }
  };

  const handleTranslation = async (textToTranslate) => {
      setIsTranslating(true);
      setError("");
      try {
          const data = await translateSpeaking(textToTranslate).unwrap();
          setTranslations(data);
      } catch (err) {
          setError("Tarjima qilishda xatolik yuz berdi.");
      } finally {
          setIsTranslating(false);
      }
  };

  const toggleEnglishPractice = (type) => {
      if (isPracticing) {
          englishRecognition.stop();
      } else {
          setPracticeType(type);
          setSpokenEnglish("");
          setEvaluationData(null);
          englishRecognition.start();
          setIsPracticing(true);
      }
  };

  const evaluateSpeech = async (spokenRawText, currentPracticeType) => {
      setIsEvaluating(true);
      const targetSentence = translations[currentPracticeType];

      try {
          const data = await evaluateSpeakingMutation({ targetSentence, spokenText: spokenRawText }).unwrap();
          setEvaluationData(data);
      } catch (err) {
          setError("Sun'iy intellekt baholashda xatolik berdi.");
      } finally {
          setIsEvaluating(false);
      }
  };

  // Helper to find the best available English voice
  const getBestVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return null;
      
      const enVoices = voices.filter(v => v.lang.startsWith('en'));
      
      // Prioritize natural or premium sounding voices
      const preferredVoices = [
          'Google UK English Female',
          'Google UK English Male',
          'Google US English',
          'Microsoft Sonia Online',
          'Microsoft Aria Online',
          'Microsoft Guy Online',
          'Samantha', // Mac premium
          'Daniel',   // Mac premium
          'Alex'
      ];

      for (const pref of preferredVoices) {
          const match = enVoices.find(v => v.name.includes(pref));
          if (match) return match;
      }
      
      // Fallback to any english voice
      return enVoices[0] || voices[0];
  };

  const playAudio = (text) => {
      if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const msg = new SpeechSynthesisUtterance(text);
          msg.lang = 'en-US';
          msg.rate = 0.85;
          const bestVoice = getBestVoice();
          if (bestVoice) msg.voice = bestVoice;
          window.speechSynthesis.speak(msg);
      }
  };

  const getEvaluationColor = (color) => {
      if (color === 'green') return 'bg-green-500/10 border-green-500 text-green-600';
      if (color === 'yellow') return 'bg-yellow-500/10 border-yellow-500 text-yellow-600';
      return 'bg-red-500/10 border-red-500 text-red-600';
  };

  // Podcast Practice State
  const [activePodcast, setActivePodcast] = useState(null);
  const [podcastTranscription, setPodcastTranscription] = useState("");
  const [podcastRecognition, setPodcastRecognition] = useState(null);
  const [isPodcastListening, setIsPodcastListening] = useState(false);
  const [podcastEvaluation, setPodcastEvaluation] = useState(null);
  const podcastSpokenRef = React.useRef("");
  
  // Podcast Speech Recognition setup
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const podRec = new SpeechRecognition();
      podRec.continuous = true; // Key for long texts!
      podRec.interimResults = true;
      podRec.lang = 'en-US';

      podRec.onresult = (event) => {
        let finalTrans = '';
        let interimTrans = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTrans += event.results[i][0].transcript;
          else interimTrans += event.results[i][0].transcript;
        }
        const newText = finalTrans || interimTrans;
        podcastSpokenRef.current = newText;
        setPodcastTranscription(newText);
      };

      podRec.onerror = () => {
         setIsPodcastListening(false);
         setError("Podcast mikrofoni bilan xatolik.");
      };
      
      setPodcastRecognition(podRec);
    }
  }, []);

  const togglePodcastListening = () => {
    if (isPodcastListening) {
      podcastRecognition.stop();
      setIsPodcastListening(false);
      // Don't auto-evaluate here, let user press the "Tekshirish" button
    } else {
      setPodcastTranscription("");
      setPodcastEvaluation(null);
      podcastSpokenRef.current = "";
      setError("");
      podcastRecognition.start();
      setIsPodcastListening(true);
    }
  };

  const submitPodcastSpeech = async () => {
      if (isPodcastListening) {
          podcastRecognition.stop();
          setIsPodcastListening(false);
      }
      
      const textToEval = podcastSpokenRef.current;
      if (!textToEval || textToEval.trim().length < 5) {
          setError("Iltimos, avval matnni o'qing.");
          return;
      }
      
      setIsEvaluating(true);
      setError("");
      try {
          const data = await evaluateSpeakingMutation({ 
              targetSentence: activePodcast.content, 
              spokenText: textToEval 
          }).unwrap();
          setPodcastEvaluation(data);
      } catch (err) {
          setError("Baholashda xatolik yuz berdi.");
      } finally {
          setIsEvaluating(false);
      }
  };

  const playPodcastAudio = (text) => {
      if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const msg = new SpeechSynthesisUtterance(text);
          msg.lang = 'en-US';
          msg.rate = 0.85; // slightly slower for better listening
          const bestVoice = getBestVoice();
          if (bestVoice) msg.voice = bestVoice;
          window.speechSynthesis.speak(msg);
      }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in-up py-8 px-4">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-transparent mb-4">
          Speaking Lab
        </h2>
        <p className="text-muted-foreground text-base md:text-lg">
          O'zbek tilida gapiring, tarjimasini ko'ring yoki 1 daqiqalik podcastlarni qaytaring!
        </p>
      </div>

      {error && (
         <div className="bg-destructive/10 border border-destructive/30 text-destructive p-4 rounded-xl mb-8 text-center animate-pulse">
             {error}
         </div>
      )}

      <Tabs defaultValue="translate" className="w-full">
        <div className="flex justify-center mb-8">
            <TabsList className="grid w-[400px] grid-cols-2 p-1 bg-secondary rounded-2xl h-14">
                <TabsTrigger value="translate" className="rounded-xl font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">Translate & Speak</TabsTrigger>
                <TabsTrigger value="podcast" className="rounded-xl font-bold data-[state=active]:bg-background data-[state=active]:shadow-sm">Listen & Repeat</TabsTrigger>
            </TabsList>
        </div>

        {/* --- TAB 1: Translate & Speak --- */}
        <TabsContent value="translate" className="space-y-8 animate-fade-in">
          {/* STAGE 1: Uzbek Base Input */}
          <div className={`relative bg-card rounded-3xl p-8 border text-center transition-all duration-500 mb-8 ${isListening ? 'border-orange-500/50 shadow-lg shadow-orange-500/20' : 'border-border'}`}>
              <div className="mb-8 flex justify-center flex-col items-center">
                  <Button
                     onClick={toggleUzbekListening}
                     size="lg"
                     className={`w-24 h-24 rounded-full transition-all duration-300 mb-4 ${isListening ? 'bg-destructive hover:bg-destructive/90 animate-pulse ring-8 ring-destructive/20' : 'bg-primary hover:bg-primary/90 hover:scale-105'}`}
                  >
                      {isListening ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
                  </Button>
                  <h3 className="font-bold text-muted-foreground">O'zbekcha Ovoz 🇺🇿</h3>
              </div>

              <div className="min-h-[60px] flex flex-col justify-center items-center">
                  {!isListening && !uzbekText && <p className="text-muted-foreground italic">Mikrofonni bosing va O'zbek tilida gapiring...</p>}
                  {isListening && !uzbekText && <p className="text-orange-500 font-medium animate-pulse">Eshitmoqdaman...</p>}
                  {uzbekText && <h3 className="text-xl md:text-2xl font-bold text-card-foreground">"{uzbekText}"</h3>}
              </div>
          </div>

          {isTranslating && (
              <div className="flex flex-col items-center justify-center p-8 bg-card rounded-3xl border border-border mt-8">
                  <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                  <p className="text-muted-foreground font-medium">Mukammal tarjima qilinmoqda...</p>
              </div>
          )}

          {/* STAGE 2: English Output & Pronunciation Practice */}
          {!isTranslating && translations && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8 animate-fade-in">
                  
                  {/* Casual Column */}
                  <div className="flex flex-col gap-4">
                      <div className="bg-background rounded-3xl p-6 border border-border shadow-sm flex flex-col h-full">
                          <div className="flex justify-between items-start mb-4">
                              <div>
                                  <h4 className="font-bold text-blue-500 text-lg flex items-center gap-2">
                                     Sodda <Sparkles className="w-4 h-4" />
                                  </h4>
                              </div>
                              <Button variant="secondary" size="icon" onClick={() => playAudio(translations.casual)} className="rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white">
                                  <Volume2 className="w-5 h-5" />
                              </Button>
                          </div>
                          <p className="text-xl md:text-2xl font-black text-card-foreground mb-6 flex-grow">{translations.casual}</p>
                          
                          {/* Practice Button */}
                          <Button 
                              onClick={() => toggleEnglishPractice('casual')}
                              className={`w-full font-bold ${isPracticing && practiceType === 'casual' ? 'bg-destructive animate-pulse' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
                          >
                             {isPracticing && practiceType === 'casual' ? 'Eshitmoqdaman...' : <><AudioLines className="w-4 h-4 mr-2" /> O'zim Aytib Ko'raman</>}
                          </Button>
                      </div>
                  </div>

                  {/* Advanced Column */}
                  <div className="flex flex-col gap-4">
                      <div className="bg-background rounded-3xl p-6 border border-border shadow-sm flex flex-col h-full">
                          <div className="flex justify-between items-start mb-4">
                              <div>
                                  <h4 className="font-bold text-purple-500 text-lg flex items-center gap-2">
                                      Murakkab <Sparkles className="w-4 h-4" />
                                  </h4>
                              </div>
                              <Button variant="secondary" size="icon" onClick={() => playAudio(translations.advanced)} className="rounded-full bg-purple-500/10 text-purple-500 hover:bg-purple-500 hover:text-white">
                                  <Volume2 className="w-5 h-5" />
                              </Button>
                          </div>
                          <p className="text-xl md:text-2xl font-black text-card-foreground mb-6 flex-grow">{translations.advanced}</p>
                          
                          {/* Practice Button */}
                          <Button 
                              onClick={() => toggleEnglishPractice('advanced')}
                              className={`w-full font-bold ${isPracticing && practiceType === 'advanced' ? 'bg-destructive animate-pulse' : 'bg-purple-500 hover:bg-purple-600 text-white'}`}
                          >
                              {isPracticing && practiceType === 'advanced' ? 'Eshitmoqdaman...' : <><AudioLines className="w-4 h-4 mr-2" /> O'zim Aytib Ko'raman</>}
                          </Button>
                      </div>
                  </div>

              </div>
          )}

          {/* STAGE 3: Pronunciation Feedback Output */}
          {isEvaluating && (
              <div className="mt-8 p-6 text-center border border-border bg-card rounded-2xl">
                  <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-2" />
                  <p className="text-muted-foreground font-medium">Talaffuzingiz AI orqali tekshirilmoqda...</p>
              </div>
          )}

          {!isEvaluating && evaluationData && spokenEnglish && (
              <div className={`mt-8 p-8 border-2 rounded-3xl shadow-lg transition-all animate-fade-in ${getEvaluationColor(evaluationData.color)}`}>
                  <div className="flex justify-between items-start mb-6">
                     <div>
                         <h3 className="text-3xl font-black mb-1">Natija: {evaluationData.score} / 100</h3>
                         <p className="opacity-80 font-medium">Maqsadli gap: {translations[practiceType]}</p>
                     </div>
                     {evaluationData.score >= 90 && <span className="text-4xl">🔥</span>}
                     {evaluationData.score >= 50 && evaluationData.score < 90 && <span className="text-4xl">💪</span>}
                     {evaluationData.score < 50 && <span className="text-4xl">📚</span>}
                  </div>
                  
                  <div className="bg-background/50 rounded-xl p-4 mb-4 border border-black/10 dark:border-white/10">
                      <span className="text-xs uppercase font-bold opacity-60 block mb-1">Siz Aytdingiz:</span>
                      <p className="text-xl font-bold">"{spokenEnglish}"</p>
                  </div>

                  <p className="text-lg leading-relaxed mix-blend-multiply dark:mix-blend-lighten">
                      <span className="font-bold">Izoh: </span> 
                      {evaluationData.feedback}
                  </p>
              </div>
          )}

          {translations && !isTranslating && (
              <div className="mt-12 flex justify-center">
                 <Button variant="outline" onClick={() => { setUzbekText(""); setTranslations(null); setSpokenEnglish(""); setEvaluationData(null); }} className="rounded-full">
                     <RefreshCw className="w-4 h-4 mr-2" /> Yangi gap boshlash
                 </Button>
              </div>
          )}
        </TabsContent>

        {/* --- TAB 2: Listen & Repeat Podcasts --- */}
        <TabsContent value="podcast" className="space-y-8 animate-fade-in">
            {!activePodcast ? (
                // Podcast Selection Grid
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {podcastsData.map(podcast => (
                        <div 
                            key={podcast.id} 
                            onClick={() => setActivePodcast(podcast)}
                            className="bg-card border border-border p-6 rounded-2xl hover:border-primary/50 transition-colors cursor-pointer group hover:shadow-md"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{podcast.title}</h3>
                                <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-xs font-bold">{podcast.difficulty}</span>
                            </div>
                            <p className="text-muted-foreground text-sm line-clamp-3">
                                {podcast.content}
                            </p>
                        </div>
                    ))}
                </div>
            ) : (
                // Active Podcast Practice Area
                <div className="flex flex-col gap-6 animate-fade-in">
                    <Button variant="ghost" onClick={() => {setActivePodcast(null); setPodcastEvaluation(null); setPodcastTranscription("");}} className="w-fit text-muted-foreground">
                        Yorliqlarga qaytish
                    </Button>
                    
                    <div className="bg-card border border-border p-6 md:p-8 rounded-3xl shadow-sm">
                        <div className="flex justify-between items-start border-b border-border pb-6 mb-6">
                            <div>
                                <h2 className="text-2xl font-black mb-2">{activePodcast.title}</h2>
                                <span className="text-sm font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">{activePodcast.topic}</span>
                            </div>
                            <Button size="lg" onClick={() => playPodcastAudio(activePodcast.content)} className="rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/20">
                                <Volume2 className="w-5 h-5 mr-2" /> Eshitish
                            </Button>
                        </div>
                        
                        <p className="text-lg md:text-xl leading-relaxed text-foreground/90 font-medium mb-8">
                            {activePodcast.content}
                        </p>
                    </div>

                    {/* Microphone and Transcription Area for Podcast */}
                    <div className={`bg-card rounded-3xl p-8 border shadow-sm transition-all duration-300 ${isPodcastListening ? 'border-primary shadow-primary/10' : 'border-border'}`}>
                        <div className="flex flex-col items-center mb-6">
                            <Button
                                onClick={togglePodcastListening}
                                size="lg"
                                className={`w-20 h-20 rounded-full transition-all duration-300 mb-6 ${isPodcastListening ? 'bg-destructive hover:bg-destructive/90 animate-pulse ring-8 ring-destructive/20' : 'bg-primary hover:bg-primary/90'}`}
                            >
                                {isPodcastListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                            </Button>
                            
                            <div className="w-full text-center space-y-4">
                                {!isPodcastListening && !podcastTranscription && (
                                    <p className="text-muted-foreground font-medium">Mikrofonni bosing va yuqoridagi matnni o'qing.</p>
                                )}
                                {(podcastTranscription || isPodcastListening) && (
                                    <div className="bg-secondary/50 rounded-xl p-4 min-h-[100px] border border-border text-left relative overflow-hidden">
                                        {isPodcastListening && <div className="absolute top-2 right-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span><span className="text-xs text-muted-foreground font-bold">Yozib olinmoqda...</span></div>}
                                        <p className="text-lg text-foreground mt-4">
                                            {podcastTranscription}
                                            {isPodcastListening && <span className="inline-block w-1.5 h-5 ml-1 bg-primary animate-pulse align-middle"></span>}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end">
                            <Button 
                                onClick={submitPodcastSpeech} 
                                disabled={isEvaluating || !podcastTranscription || podcastTranscription.length < 5}
                                size="lg"
                                className="font-bold rounded-xl"
                            >
                                {isEvaluating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Tekshirilmoqda</> : "Tekshirish / Submit"}
                            </Button>
                        </div>
                    </div>

                    {/* Evaluation Result for Podcast */}
                    {!isEvaluating && podcastEvaluation && (
                        <div className={`p-8 border-2 rounded-3xl shadow-lg transition-all animate-fade-in ${getEvaluationColor(podcastEvaluation.color)}`}>
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h3 className="text-3xl font-black mb-1">Natija: {podcastEvaluation.score} / 100</h3>
                                    <p className="opacity-80 font-medium">Xatoliklar va talaffuz tahlili</p>
                                </div>
                                {podcastEvaluation.score >= 90 && <span className="text-5xl">🏆</span>}
                                {podcastEvaluation.score >= 70 && podcastEvaluation.score < 90 && <span className="text-5xl">👏</span>}
                                {podcastEvaluation.score < 70 && <span className="text-5xl">📈</span>}
                            </div>
                            
                            <p className="text-lg leading-relaxed mix-blend-multiply dark:mix-blend-lighten p-6 bg-background/40 rounded-2xl border border-current/10">
                                <span className="font-bold text-xl block mb-2">Batafsil tahlil: </span> 
                                {podcastEvaluation.feedback}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SpeakingLab;
