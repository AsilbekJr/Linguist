import React, { useState, useEffect, useRef } from 'react';
import YouTube from 'react-youtube';
import { Button } from "@/components/ui/button";
import { useEvaluateSpeakingMutation } from '../features/api/apiSlice';
import { Mic, MicOff, Play, RefreshCw, AudioLines, Sparkles, Loader2, ChevronLeft, Film, Trophy } from 'lucide-react';
import { moviesData } from '../data/moviesData';

const MovieLab = () => {
  const [activeMovie, setActiveMovie] = useState(null);
  const [player, setPlayer] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Shadowing state
  const [isListening, setIsListening] = useState(false);
  const [spokenText, setSpokenText] = useState("");
  const [recognition, setRecognition] = useState(null);
  const [error, setError] = useState("");
  
  // Evaluation state
  const [evaluateSpeakingMutation, { isLoading: isEvaluating }] = useEvaluateSpeakingMutation();
  const [evaluationData, setEvaluationData] = useState(null);

  const spokenTextRef = useRef("");

  // Setup Web Speech API for English
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event) => {
        let finalTrans = '';
        let interimTrans = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTrans += event.results[i][0].transcript;
          else interimTrans += event.results[i][0].transcript;
        }
        const newText = finalTrans || interimTrans;
        spokenTextRef.current = newText;
        setSpokenText(newText);
      };

      rec.onend = () => {
        setIsListening(false);
        const finalSpoken = spokenTextRef.current;
        
        if (finalSpoken.trim().length > 1 && activeMovie) {
            handleEvaluate(finalSpoken);
        }
      };

      rec.onerror = () => {
        setIsListening(false);
        setError("Mikrofon xatoligi yuz berdi.");
      };

      setRecognition(rec);
    }
  }, [activeMovie]);

  // YouTube Player Options
  const opts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: 0, // hide controls for a clean UI
      disablekb: 1,
      modestbranding: 1,
      rel: 0,
      fs: 0,
    },
  };

  const handleStateChange = (event) => {
    // Stop video when it hits the endSecond
    if (event.data === window.YT.PlayerState.PLAYING && activeMovie) {
       const checkTime = setInterval(() => {
          if (event.target.getCurrentTime() >= activeMovie.endSeconds) {
              event.target.pauseVideo();
              setIsPlaying(false);
              clearInterval(checkTime);
          }
       }, 100);
    }
  };

  const handlePlayClip = () => {
      if (player && activeMovie) {
          setEvaluationData(null);
          setSpokenText("");
          setError("");
          player.seekTo(activeMovie.startSeconds);
          player.playVideo();
          setIsPlaying(true);
      }
  };

  const togglePractice = () => {
      if (!recognition) {
          setError("Speech API qo'llab-quvvatlanmaydi.");
          return;
      }
      if (isListening) {
          recognition.stop();
      } else {
          setSpokenText("");
          setEvaluationData(null);
          setError("");
          recognition.start();
          setIsListening(true);
      }
  };

  const handleEvaluate = async (textToEval) => {
      try {
          const data = await evaluateSpeakingMutation({
              targetSentence: activeMovie.targetSentence,
              spokenText: textToEval
          }).unwrap();
          setEvaluationData(data);
      } catch (err) {
          setError("Baholashda xatolik yuz berdi.");
      }
  };

  const getEvaluationColor = (color) => {
      if (color === 'green') return 'bg-green-500/10 border-green-500 text-green-600';
      if (color === 'yellow') return 'bg-yellow-500/10 border-yellow-500 text-yellow-600';
      return 'bg-red-500/10 border-red-500 text-red-600';
  };

  const renderSubtitle = (text, targetWords) => {
      if (!text) return null;
      const words = text.split(" ");
      return words.map((w, i) => {
          const cleanW = w.toLowerCase().replace(/[.,!?;:()]/g, '');
          const isTarget = targetWords.some(t => t.toLowerCase() === cleanW);
          return (
              <span key={i} className={isTarget ? "text-primary font-bold bg-primary/20 px-1 rounded mx-0.5" : "text-white"}>
                  {w}{" "}
              </span>
          );
      });
  };

  // View 1: Selection Grid
  if (!activeMovie) {
      return (
          <div className="max-w-6xl mx-auto py-8 px-4 animate-fade-in">
              <div className="text-center mb-12">
                  <h2 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent mb-4 flex items-center justify-center gap-3">
                     <Film className="w-10 h-10 text-red-500" /> Movie Lab 🍿
                  </h2>
                  <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto">
                      Kinodagi asl (native) talaffuzlarni eshiting va ularni aynan shunday qaytarishga harakat qiling (Shadowing).
                  </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {moviesData.map(movie => (
                      <div 
                          key={movie.id} 
                          onClick={() => setActiveMovie(movie)}
                          className="bg-card rounded-2xl overflow-hidden border border-border hover:border-red-500/50 hover:shadow-xl hover:shadow-red-500/10 transition-all cursor-pointer group"
                      >
                          <div className="relative aspect-video overflow-hidden">
                              <img src={movie.thumbnail} alt={movie.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg shadow-red-600/50">
                                      <Play className="w-8 h-8 text-white ml-1" />
                                  </div>
                              </div>
                              <div className="absolute top-3 right-3">
                                  <span className={`px-2 py-1 text-xs font-bold rounded-md bg-black/60 backdrop-blur-md text-white border ${movie.difficulty === 'Easy' ? 'border-green-500 text-green-400' : movie.difficulty === 'Medium' ? 'border-yellow-500 text-yellow-400' : 'border-red-500 text-red-400'}`}>
                                      {movie.difficulty}
                                  </span>
                              </div>
                          </div>
                          <div className="p-5">
                              <h3 className="font-bold text-lg mb-2 text-card-foreground group-hover:text-red-500 transition-colors line-clamp-1">{movie.title}</h3>
                              <p className="text-sm text-muted-foreground italic line-clamp-2">"{movie.translation}"</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      );
  }

  // View 2: Active Movie Player & Practice Area
  return (
      <div className="max-w-5xl mx-auto py-6 px-4 animate-fade-in flex flex-col min-h-[85vh]">
          <Button 
            variant="ghost" 
            onClick={() => setActiveMovie(null)}
            className="mb-6 w-fit text-muted-foreground hover:text-foreground"
          >
              <ChevronLeft className="w-4 h-4 mr-2" /> Filmlarga qaytish
          </Button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
              
              {/* Left Side: Video Player */}
              <div className="flex flex-col gap-4">
                  <div className="w-full aspect-video bg-black rounded-3xl overflow-hidden border-4 border-card shadow-2xl relative group">
                      <YouTube 
                          videoId={activeMovie.videoId} 
                          opts={opts} 
                          onReady={(e) => setPlayer(e.target)} 
                          onStateChange={handleStateChange}
                          className="w-full h-full"
                      />
                      {/* Subtitle Overlay Overlay */}
                      <div className="absolute bottom-4 left-0 right-0 px-8 text-center pointer-events-none">
                          <p className="bg-black/70 backdrop-blur-sm text-white md:text-xl lg:text-2xl font-bold py-2 px-4 rounded-xl border border-white/10 shadow-lg inline-block text-shadow">
                             {renderSubtitle(activeMovie.targetSentence, activeMovie.targetWords)}
                          </p>
                      </div>
                  </div>

                  <div className="bg-card rounded-3xl p-6 border border-border flex items-center justify-between">
                      <div>
                          <h2 className="text-xl font-bold">{activeMovie.title}</h2>
                          <p className="text-sm text-muted-foreground mt-1">{activeMovie.translation}</p>
                      </div>
                      <Button 
                          onClick={handlePlayClip} 
                          size="lg" 
                          className="rounded-full w-14 h-14 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 shrink-0"
                          disabled={isPlaying}
                      >
                          {isPlaying ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6 ml-1" />}
                      </Button>
                  </div>
              </div>

              {/* Right Side: Shadowing Practice */}
              <div className="flex flex-col gap-6">
                  
                  <div className="bg-card rounded-3xl p-6 lg:p-10 border border-border shadow-md flex-1 flex flex-col">
                      <div className="text-center mb-8">
                          <h3 className="text-2xl font-black mb-2 text-foreground">Sizning navbatingiz! 🎤</h3>
                          <p className="text-muted-foreground">Videoni eshitgach, yozuvni bosing va sahnadagi kabi o'qishga harakat qiling.</p>
                      </div>

                      <div className="flex-1 flex flex-col justify-center items-center">
                          {error && (
                             <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm mb-6 font-medium animate-pulse">
                                 {error}
                             </div>
                          )}

                          <Button
                             onClick={togglePractice}
                             size="lg"
                             className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full transition-all duration-300 mb-8 ${isListening ? 'bg-red-500 hover:bg-red-600 animate-pulse ring-8 ring-red-500/30' : 'bg-primary hover:bg-primary/90 hover:scale-105 shadow-xl shadow-primary/20'}`}
                          >
                             {isListening ? <MicOff className="w-10 h-10 sm:w-14 sm:h-14 text-white" /> : <Mic className="w-10 h-10 sm:w-14 sm:h-14 text-white" />}
                          </Button>

                          <div className="min-h-[60px] w-full text-center">
                              {!isListening && !spokenText && <p className="text-muted-foreground font-medium">Boshlash uchun mikrofonni bosing</p>}
                              {isListening && !spokenText && <p className="text-primary font-bold animate-pulse">Eshitmoqdaman...</p>}
                              {spokenText && <p className="text-xl md:text-2xl font-bold bg-secondary/50 p-4 rounded-xl border border-border animate-fade-in">"{spokenText}"</p>}
                          </div>
                      </div>
                  </div>

                  {/* Evaluation Result */}
                  {isEvaluating && (
                      <div className="bg-card rounded-3xl p-6 border border-border text-center flex items-center justify-center gap-3 animate-pulse">
                          <Loader2 className="w-6 h-6 text-primary animate-spin" />
                          <span className="font-bold text-lg">AI natijani tekshirmoqda...</span>
                      </div>
                  )}

                  {!isEvaluating && evaluationData && spokenText && (
                      <div className={`rounded-3xl p-6 border-2 shadow-lg animate-fade-in-up ${getEvaluationColor(evaluationData.color)}`}>
                          <div className="flex justify-between items-start mb-4">
                             <div>
                                 <h3 className="text-3xl font-black mb-1">Natija: {evaluationData.score}/100</h3>
                                 <p className="font-medium opacity-80">Shadowing Score</p>
                             </div>
                             {evaluationData.score >= 90 && <Trophy className="w-10 h-10 text-yellow-500 drop-shadow-md" />}
                             {evaluationData.score >= 50 && evaluationData.score < 90 && <Sparkles className="w-10 h-10 text-blue-500" />}
                          </div>
                          <div className="p-4 bg-background/50 rounded-xl mb-3 border border-current/10">
                              <p className="font-bold text-shadow-sm">Talaffuz izohi: {evaluationData.feedback}</p>
                          </div>
                      </div>
                  )}

              </div>
          </div>
      </div>
  );
};

export default MovieLab;
