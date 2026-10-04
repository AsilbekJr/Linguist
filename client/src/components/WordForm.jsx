import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, AlertTriangle, Sparkles, CornerDownLeft, Mic, MicOff } from "lucide-react";
import { Segmented } from './ui/primitives';
import UzbekWordForm from './UzbekWordForm';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { suggestWords, preloadWordlist } from '@/utils/wordSuggest';

const EnglishWordForm = ({ onAddWord, existingWords = [] }) => {
  const [word, setWord] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showForceSave, setShowForceSave] = useState(false);
  const [manualDefinition, setManualDefinition] = useState('');
  const [manualExample, setManualExample] = useState('');
  const [manualTranslation, setManualTranslation] = useState('');

  // ─── Yozayotganda chiqadigan takliflar ────────────────────────────────────
  //
  // Yuqoridagi `suggestions` — bu boshqa narsa: u serverdan "shuni nazarda
  // tutdingizmi?" javobi bilan keladi va faqat xatodan keyin ko'rinadi.
  const [completions, setCompletions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const inputRef = useRef(null);
  /** Sekin kelgan eski javob yangisini bosib ketmasligi uchun */
  const requestRef = useRef(0);
  const speech = useSpeechInput({ lang: 'en-US', onResult: value => { setWord(value); setError(null); setDismissed(false); } });

  // Foydalanuvchida allaqachon bor so'zlarni taklif qilmaymiz — bosilsa
  // serverdan DUPLICATE xatosi kelardi
  const excludeSet = useMemo(
    () => new Set(existingWords.map((w) => String(w?.word ?? w).toLowerCase())),
    [existingWords]
  );

  useEffect(() => {
    const query = word.trim();
    if (!query) {
      setCompletions([]);
      setActiveIndex(-1);
      return;
    }

    const token = ++requestRef.current;
    suggestWords(query, { exclude: excludeSet }).then((list) => {
      if (token !== requestRef.current) return; // eskirgan javob
      setCompletions(list);
      setActiveIndex(-1);
    });
  }, [word, excludeSet]);

  const listOpen = focused && !dismissed && !loading && !error && completions.length > 0;

  const pickCompletion = (value) => {
    // Ataylab yuborilmaydi: so'z maydonga qo'yiladi, qo'shishni foydalanuvchi
    // o'zi tasdiqlaydi. Tasodifiy bosish keraksiz so'zni SRS navbatiga
    // tushirib yubormasligi kerak.
    setWord(value);
    setDismissed(true);
    setActiveIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (!listOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % completions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? completions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pickCompletion(completions[activeIndex]);
    } else if (e.key === 'Escape') {
      // stopPropagation MUHIM: WordForm modal ichida turadi va Escape
      // to'xtatilmasa Radix Dialog butun oynani yopib yuborardi
      e.preventDefault();
      e.stopPropagation();
      setDismissed(true);
    }
  };

  const handleSubmit = async (e, skipAI = false) => {
    if (e) e.preventDefault();
    if (!word.trim()) return;

    setLoading(true);
    setError(null);
    setSuggestions([]);
    setShowForceSave(false);
    setDismissed(true);

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
      } else if (err.type === 'QUOTA_EXCEEDED' || err.type === 'ENRICHMENT_FAILED') {
          // Lug'at xizmatiga ulanib bo'lmadi. So'z SAQLANMADI — aks holda u
          // ta'rifsiz kartochka bo'lib SRS navbatiga tushib qolardi. Shu yerda
          // qo'lda ta'rif kiritish imkonini beramiz.
          setError(err.message);
          setShowForceSave(true);
      } else {
          setError(err.message || "Nimadir noto'g'ri ketdi. Qayta urinib ko'ring.");
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
    <form onSubmit={(e) => handleSubmit(e, false)} className="relative w-full space-y-3">
      <label htmlFor="new-word" className="sr-only">Inglizcha so&apos;z</label>
      <div className="relative">
        <div
          className={`flex items-center gap-1.5 rounded-2xl border bg-card p-1.5 shadow-xs transition-[border-color,box-shadow] focus-within:ring-4 ${
            error
              ? 'border-destructive focus-within:ring-destructive/15'
              : 'border-input focus-within:border-primary focus-within:ring-primary/15'
          }`}
        >
          <Input
            id="new-word"
            ref={inputRef}
            type="text"
            value={word}
            onChange={(e) => {
                setWord(e.target.value);
                setError(null);
                setShowForceSave(false);
                setDismissed(false);
            }}
            onFocus={() => {
                setFocused(true);
                // Ro'yxat chunk'ini oldindan yuklaymiz — birinchi harf
                // yozilgunicha u tayyor bo'ladi
                preloadWordlist();
            }}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder="masalan: journey"
            className="h-11 flex-1 border-0 bg-transparent px-3 text-lg shadow-none hover:border-0 focus-visible:ring-0"
            disabled={loading}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck="false"
            autoFocus
            role="combobox"
            aria-expanded={listOpen}
            aria-controls="word-completions"
            aria-autocomplete="list"
            aria-invalid={Boolean(error)}
            aria-activedescendant={activeIndex >= 0 ? `word-completion-${activeIndex}` : undefined}
          />
          <Button type="submit" disabled={loading || !word.trim()} className="shrink-0 rounded-xl">
            {loading ? (
              <>
                <Loader2 className="animate-spin" /> Qidirilmoqda
              </>
            ) : (
              <>
                <Plus /> Qo&apos;shish
              </>
            )}
          </Button>
        </div>

        <AnimatePresence>
          {listOpen && (
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              id="word-completions"
              role="listbox"
              aria-label="So'z takliflari"
              // max-h to'liq 8 ta element sig'adigan qilib tanlangan
              className="absolute inset-x-0 top-full z-50 mt-2 max-h-[21rem] overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 shadow-xl"
            >
              {completions.map((item, i) => (
                <li
                  key={item}
                  id={`word-completion-${i}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  // onMouseDown + preventDefault: aks holda input avval
                  // blur bo'lib ro'yxat yopilardi va onClick hech qachon
                  // ishlamasdi
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickCompletion(item)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-base transition-colors ${
                    i === activeIndex ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent'
                  }`}
                >
                  <span>
                    <span className="font-bold">{item.slice(0, word.trim().length)}</span>
                    {item.slice(word.trim().length)}
                  </span>
                  {i === activeIndex && <CornerDownLeft className="size-4 opacity-60" />}
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      {speech.supported && <Button type="button" variant={speech.listening ? 'destructive' : 'outline'} onClick={speech.toggle} disabled={loading}>{speech.listening ? <MicOff /> : <Mic />} Inglizcha aytish</Button>}
      {speech.interim && <p className="text-sm text-muted-foreground">{speech.interim}</p>}
      {speech.error && <p role="alert" className="text-sm text-destructive">{speech.error}</p>}

      <AnimatePresence initial={false}>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/8 p-4" role="alert">
              <p className="flex items-start gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
              </p>

              {showForceSave && (
                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Ma&apos;lumotni o&apos;zingiz kiritib saqlashingiz mumkin:
                  </p>
                  <Input
                    type="text"
                    value={manualDefinition}
                    onChange={(e) => setManualDefinition(e.target.value)}
                    placeholder="Ta'rif (majburiy) — masalan: a long trip"
                    aria-label="Ta'rif"
                    disabled={loading}
                  />
                  <Input
                    type="text"
                    value={manualTranslation}
                    onChange={(e) => setManualTranslation(e.target.value)}
                    placeholder="Tarjima — masalan: sayohat"
                    aria-label="Tarjima"
                    disabled={loading}
                  />
                  <Input
                    type="text"
                    value={manualExample}
                    onChange={(e) => setManualExample(e.target.value)}
                    placeholder="Misol gap — masalan: The journey took two days."
                    aria-label="Misol gap"
                    disabled={loading}
                  />
                  <Button
                    type="button"
                    disabled={!manualDefinition.trim() || loading}
                    onClick={() => handleSubmit(null, true)}
                    className="w-full"
                  >
                    Qo&apos;lda saqlash
                  </Button>
                </div>
              )}

              {suggestions.length > 0 && (
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Shuni nazarda tutdingizmi?</p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <Button key={s} type="button" variant="soft" size="sm" onClick={() => handleSuggestionClick(s)}>
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!error && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          Harf yozishingiz bilan takliflar chiqadi — tanlash uchun ↑ ↓ va Enter
        </p>
      )}
    </form>
  );
};

const WordForm = props => {
  const [language, setLanguage] = useState('en');
  return <div className="space-y-4">
    <Segmented ariaLabel="Kiritish tili" layoutId="word-input-language" value={language} onChange={setLanguage} options={[{ value: 'en', label: 'Inglizcha' }, { value: 'uz', label: "O'zbekcha" }]} />
    {language === 'uz' ? <UzbekWordForm {...props} /> : <EnglishWordForm {...props} />}
  </div>;
};

export default WordForm;
