import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle2, CloudLightning, ShoppingBag, Users, Plane, Briefcase, HeartPulse, Laptop } from "lucide-react";

// Curated dictionary data
const dictionaryData = [
  {
    id: 'weather',
    title: 'Ob-havo (Weather)',
    icon: CloudLightning,
    color: 'text-blue-500',
    words: [
      { word: 'Drizzle', translation: 'Mayda yomg\'ir', definition: 'Light rain falling in very fine drops.', example: 'It was beginning to drizzle, so she took an umbrella.' },
      { word: 'Overcast', translation: 'Bulutli (Buluq)', definition: 'Covered with clouds; dull.', example: 'It was a gloomy, overcast morning.' },
      { word: 'Scorching', translation: 'Juda issiq (Jazirama)', definition: 'Very hot.', example: 'They walked outside into the scorching heat.' },
      { word: 'Breeze', translation: 'Shabada', definition: 'A gentle wind.', example: 'A cool breeze blew through the open window.' },
    ]
  },
  {
    id: 'shopping',
    title: 'Xarid qilish (Shopping)',
    icon: ShoppingBag,
    color: 'text-pink-500',
    words: [
      { word: 'Bargain', translation: 'Arzon narsa / Savdolashmoq', definition: 'A thing bought or offered for sale more cheaply than is usual or expected.', example: 'The second-hand table was a real bargain.' },
      { word: 'Receipt', translation: 'Kvitansiya (Chek)', definition: 'A written or printed statement acknowledging that something has been paid for.', example: 'Please keep your receipt as proof of purchase.' },
      { word: 'Refund', translation: 'Pulni qaytarish', definition: 'A repayment of a sum of money.', example: 'If you are not satisfied, we will give you a full refund.' },
      { word: 'Showcase', translation: 'Vitrina', definition: 'A glass case used for displaying articles in a shop or museum.', example: 'The rare jewel was displayed in a secure showcase.' },
    ]
  },
  {
    id: 'intro',
    title: 'Tanishuv (Introductions)',
    icon: Users,
    color: 'text-green-500',
    words: [
      { word: 'Acquaintance', translation: 'Tanish', definition: 'A person\'s knowledge or experience of something, or someone known slightly.', example: 'He is more of an acquaintance than a friend.' },
      { word: 'Sociable', translation: 'Kirishimli (Suhbatkash)', definition: 'Willing to talk and engage in activities with other people; friendly.', example: 'She is a very sociable person who loves hosting parties.' },
      { word: 'Greeting', translation: 'Salomlashish', definition: 'A polite word or sign of welcome or recognition.', example: 'He gave her a warm greeting.' },
      { word: 'Fascinating', translation: 'Maftunkor / Qiziqarli', definition: 'Extremely interesting.', example: 'I found her travels fascinating to listen to.' },
    ]
  },
  {
    id: 'travel',
    title: 'Sayohat (Travel)',
    icon: Plane,
    color: 'text-purple-500',
    words: [
      { word: 'Itinerary', translation: 'Sayohat yo\'nalishi', definition: 'A planned route or journey.', example: 'We will send you a revised itinerary.' },
      { word: 'Layover', translation: 'To\'xtab o\'tish (Tranzit)', definition: 'A period of rest or waiting before a further stage in a journey.', example: 'We had a four-hour layover in Paris.' },
      { word: 'Scenic', translation: 'Manzarali', definition: 'Providing or relating to views of impressive or beautiful natural scenery.', example: 'We took the scenic route along the coast.' },
      { word: 'Wanderlust', translation: 'Sayohatga ishtiyoq', definition: 'A strong desire to travel.', example: 'His wanderlust led him to explore over thirty countries.' },
    ]
  },
  {
    id: 'work',
    title: 'Ish va Biznes (Work)',
    icon: Briefcase,
    color: 'text-amber-500',
    words: [
      { word: 'Colleague', translation: 'Hamkasb', definition: 'A person with whom one works in a profession or business.', example: 'He is a former colleague of mine.' },
      { word: 'Deadline', translation: 'Tugatish muddati (Dedlayn)', definition: 'The latest time or date by which something should be completed.', example: 'I have a strict deadline to meet by Friday.' },
      { word: 'Revenue', translation: 'Daromad (Tushum)', definition: 'Income, especially when of a company or organization.', example: 'The company\'s revenue increased by 20% this year.' },
      { word: 'Negotiate', translation: 'Muzokara olib bormoq', definition: 'Try to reach an agreement or compromise by discussion.', example: 'They are willing to negotiate on the price.' },
    ]
  },
  {
    id: 'health',
    title: 'Salomatlik (Health)',
    icon: HeartPulse,
    color: 'text-red-500',
    words: [
      { word: 'Symptom', translation: 'Alomat', definition: 'A physical or mental feature which is regarded as indicating a condition of disease.', example: 'Fever is a common symptom of the flu.' },
      { word: 'Prescription', translation: 'Retsept (Doriga ruxsatnoma)', definition: 'An instruction written by a medical practitioner that authorizes a patient to be provided with a medicine.', example: 'The doctor wrote a prescription for antibiotics.' },
      { word: 'Remedy', translation: 'Dori / Chora', definition: 'A medicine or treatment for a disease or injury.', example: 'Herbal tea is a good remedy for a sore throat.' },
      { word: 'Fatigue', translation: 'Horg\'inlik (Charchoq)', definition: 'Extreme tiredness resulting from mental or physical exertion or illness.', example: 'He was suffering from muscle fatigue.' },
    ]
  },
  {
    id: 'tech',
    title: 'Texnologiya (Technology)',
    icon: Laptop,
    color: 'text-cyan-500',
    words: [
      { word: 'Algorithm', translation: 'Algoritm', definition: 'A process or set of rules to be followed in calculations or other problem-solving operations.', example: 'The new algorithm improves search results significantly.' },
      { word: 'Bandwidth', translation: 'O\'tkazish qobiliyati / Imkoniyat', definition: 'The energy or mental capacity required to deal with a situation.', example: 'I don\'t have the bandwidth to take on another project right now.' },
      { word: 'Glitch', translation: 'Kichik xatolik (Texnik)', definition: 'A sudden, usually temporary malfunction or fault of equipment.', example: 'A software glitch caused the system to crash briefly.' },
      { word: 'Innovation', translation: 'Yangilik (Innovatsiya)', definition: 'The action or process of innovating.', example: 'Technological innovation is changing the entire industry.' },
    ]
  }
];

const Dictionary = ({ onAddWord, userWords }) => {
  const [addingState, setAddingState] = useState({});

  // Get a set of already added words for fast lookup
  const userWordMap = new Set(userWords.map(w => w.word.toLowerCase()));

  const handleSaveToLab = async (wordData) => {
    setAddingState(prev => ({ ...prev, [wordData.word]: 'loading' }));
    
    // We package the exact data from dictionary to bypass AI and prepopulate translation
    const manualData = {
        manualDefinition: wordData.definition,
        manualExample: wordData.example,
        manualTranslation: wordData.translation
    };

    try {
        await onAddWord(wordData.word, true, manualData);
        setAddingState(prev => ({ ...prev, [wordData.word]: 'success' }));
        
        // Reset success state after 2 seconds
        setTimeout(() => {
             setAddingState(prev => ({ ...prev, [wordData.word]: null }));
        }, 2000);
    } catch (err) {
        console.error("Failed to add dictionary word:", err);
        setAddingState(prev => ({ ...prev, [wordData.word]: 'error' }));
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in-up">
      <div className="mb-12 text-center">
        <h2 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent mb-4">
          Pocket Dictionary
        </h2>
        <p className="text-muted-foreground text-lg">Curated vocabulary by topic with Uzbek translations.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {dictionaryData.map(topic => (
            <div key={topic.id} className="bg-card rounded-3xl p-6 border border-border shadow-lg">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/50">
                    <div className={`p-3 rounded-xl bg-background border border-border ${topic.color}`}>
                        <topic.icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-2xl font-bold text-card-foreground">
                        {topic.title}
                    </h3>
                </div>

                <div className="space-y-4">
                    {topic.words.map((item, idx) => {
                        const isAdded = userWordMap.has(item.word.toLowerCase());
                        const status = addingState[item.word];

                        return (
                            <div key={idx} className="group relative bg-background border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-all hover:border-primary/50 hover:shadow-md">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h4 className="text-xl font-black text-card-foreground">{item.word}</h4>
                                        <Badge variant="outline" className="text-primary border-primary/20 bg-primary/5">
                                            {item.translation}
                                        </Badge>
                                    </div>
                                    <p className="text-muted-foreground text-sm mb-2">{item.definition}</p>
                                    <div className="italic text-muted-foreground/80 text-sm border-l-2 border-primary/30 pl-3">
                                        "{item.example}"
                                    </div>
                                </div>
                                
                                <div className="sm:self-center shrink-0">
                                    <Button 
                                        variant={isAdded || status === 'success' ? "secondary" : "default"}
                                        size="sm"
                                        disabled={isAdded || status === 'loading' || status === 'success'}
                                        onClick={() => handleSaveToLab(item)}
                                        className={`w-full sm:w-auto font-medium transition-all ${
                                            isAdded || status === 'success' ? 'bg-green-500/20 text-green-500 hover:bg-green-500/20' : ''
                                        }`}
                                    >
                                        {status === 'loading' && <span className="animate-pulse">Saving...</span>}
                                        {(isAdded || status === 'success') && <><CheckCircle2 className="w-4 h-4 mr-2" /> In Your Lab</>}
                                        {!isAdded && status !== 'success' && status !== 'loading' && <><Plus className="w-4 h-4 mr-2" /> Add to Flow</>}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default Dictionary;
