import React, { useRef, useState } from 'react';
import { Languages, Loader2, Mic, MicOff, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { usePreviewWordMutation } from '../features/api/apiSlice';
import { useSpeechInput } from '../hooks/useSpeechInput';

const UzbekWordForm = ({ onAddWord }) => {
  const [text, setText] = useState('');
  const [options, setOptions] = useState([]);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [preview, { isLoading }] = usePreviewWordMutation();
  const requestRef = useRef(0);
  const updateInput = value => {
    requestRef.current += 1;
    setText(value);
    setOptions([]);
    setDraft(null);
    setError('');
  };
  const speech = useSpeechInput({ lang: 'uz-UZ', onResult: updateInput });
  const field = (key, value) => setDraft(current => ({ ...current, ...(key === 'word' ? { definition: '' } : {}), [key]: value }));

  const lookup = async event => {
    event.preventDefault();
    if (!text.trim() || isLoading) return;
    const request = ++requestRef.current;
    setError('');
    try {
      const response = await preview({ text: text.trim(), language: 'uz' }).unwrap();
      if (request !== requestRef.current) return;
      if (!response.options?.length) throw new Error("Tarjima topilmadi.");
      setOptions(response.options);
      setDraft({ ...response.options[0] });
    } catch (err) {
      if (request === requestRef.current) setError(err?.data?.message || err.message || "Tarjimani topib bo'lmadi.");
    }
  };

  const save = async event => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    speech.stop();
    try {
      await onAddWord(draft.word.trim(), true, {
        manualDefinition: draft.definition || '',
        manualTranslation: draft.translation.trim(),
        manualExample: draft.example.trim(),
        manualExampleUz: draft.exampleUz.trim(),
      });
    } catch (err) { setError(err?.message || "So'zni saqlab bo'lmadi."); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={lookup} className="space-y-2">
        <label htmlFor="uzbek-word" className="text-sm font-bold">O&apos;zbekcha so&apos;z</label>
        <div className="flex gap-2">
          <Input id="uzbek-word" value={text} onChange={event => updateInput(event.target.value)} placeholder="masalan: olma" maxLength={80} disabled={saving} autoFocus />
          {speech.supported && <Button type="button" variant={speech.listening ? 'destructive' : 'outline'} onClick={speech.toggle} disabled={saving || isLoading} aria-label="O'zbekcha aytish">{speech.listening ? <MicOff /> : <Mic />}</Button>}
        </div>
        {speech.interim && <p className="text-sm text-muted-foreground">{speech.interim}</p>}
        {speech.error && <p role="alert" className="text-sm text-destructive">{speech.error}</p>}
        <Button type="submit" disabled={!text.trim() || isLoading || saving} className="w-full">{isLoading ? <Loader2 className="animate-spin" /> : <Languages />} Tarjimani topish</Button>
      </form>
      {error && <div role="alert" className="space-y-2 rounded-xl bg-destructive/8 p-3 text-sm text-destructive">
        <p>{error}</p>
        {!draft && <Button type="button" variant="outline" onClick={() => setDraft({ word: '', translation: text, definition: '', example: '', exampleUz: '' })}>Tarjimani qo&apos;lda kiritish</Button>}
      </div>}
      {draft && <form onSubmit={save} className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm text-muted-foreground">Ma&apos;noni va gapni tekshiring. Saqlagach so&apos;z ham, uning misol gapi ham o&apos;z jadvalida takrorlanadi.</p>
        {options.length > 1 && <div className="flex flex-wrap gap-2" aria-label="Tarjima variantlari">{options.map(option => <Button key={option.word} type="button" variant={draft.word === option.word ? 'soft' : 'outline'} size="sm" onClick={() => setDraft({ ...option })} disabled={saving}>{option.word}</Button>)}</div>}
        {[['word', 'Inglizcha tarjima', 80], ['translation', "O'zbekcha ma'no", 120], ['example', 'Misol gap', 400], ['exampleUz', 'Gap tarjimasi', 500]].map(([key, label, max]) => <label key={key} className="block space-y-1 text-sm font-semibold">
          <span>{label}</span><Input value={draft[key] || ''} onChange={event => field(key, event.target.value)} maxLength={max} required disabled={saving} />
        </label>)}
        <Button type="submit" className="w-full" disabled={saving || !draft.word?.trim() || !draft.translation?.trim() || !draft.example?.trim() || !draft.exampleUz?.trim()}>{saving ? <Loader2 className="animate-spin" /> : <Save />} Saqlash va takrorlash</Button>
      </form>}
    </div>
  );
};

export default UzbekWordForm;
