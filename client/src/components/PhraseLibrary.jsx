import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowLeft, ArrowLeftRight, Languages, Loader2, Mic, MicOff, Plus, Quote, Repeat2, Volume2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { EmptyState, Skeleton } from './ui/primitives';
import { useGetPhrasesQuery, useAddPhraseMutation, useTranslatePhraseMutation } from '../features/api/apiSlice';
import { useSpeechInput } from '../hooks/useSpeechInput';
import { playTTSAudio } from '../utils/audio';
import { formatUzDate } from '../utils/dateUtils';
import PhraseReview from './TodayHub/PhraseReview';

const PhraseLibrary = ({ words = [], wordId = '' }) => {
  const { data: phrases = [], isLoading, isError, refetch } = useGetPhrasesQuery();
  const [addPhrase, { isLoading: isSaving }] = useAddPhraseMutation();
  const [translatePhrase, { isLoading: isTranslating }] = useTranslatePhraseMutation();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [textUz, setTextUz] = useState('');
  const [linkedWordId, setLinkedWordId] = useState(wordId);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [sourceLanguage, setSourceLanguage] = useState('en');
  const revisionRef = useRef(0);
  const uzbekFirst = sourceLanguage === 'uz';
  const sourceText = uzbekFirst ? textUz : text;
  const changeSource = value => {
    revisionRef.current++;
    setError('');
    if (uzbekFirst) { setTextUz(value); setText(''); }
    else { setText(value); setTextUz(''); }
  };
  const changeTarget = value => {
    revisionRef.current++;
    if (uzbekFirst) setText(value);
    else setTextUz(value);
  };
  const speech = useSpeechInput({ lang: uzbekFirst ? 'uz-UZ' : 'en-US', onResult: changeSource });
  const filtered = wordId ? phrases.filter(phrase => phrase.wordIds?.includes(wordId)) : phrases;
  const selectedWord = words.find(word => word._id === wordId);
  const due = filtered.filter(phrase => !phrase.learned && new Date(phrase.nextReviewDate) <= new Date());

  const translate = async () => {
    if (!sourceText.trim() || isTranslating || speech.listening) return;
    const revision = ++revisionRef.current;
    setError('');
    try {
      const result = await translatePhrase({ text: sourceText.trim(), sourceLanguage }).unwrap();
      if (revision !== revisionRef.current) return;
      if (uzbekFirst) setText(result.translation);
      else setTextUz(result.translation);
    } catch (err) {
      if (revision === revisionRef.current) setError(err?.data?.message || "Tarjimani yuklab bo'lmadi. Qo'lda kiritishingiz mumkin.");
    }
  };

  const save = async event => {
    event.preventDefault();
    if (isSaving || isTranslating || speech.listening) return;
    speech.stop();
    setError('');
    try {
      await addPhrase({ text: text.trim(), textUz: textUz.trim(), ...(linkedWordId ? { wordId: linkedWordId } : {}) }).unwrap();
      setOpen(false);
      setText('');
      setTextUz('');
      toast.success('Gap saqlandi — takrorlash navbatida');
    } catch (err) { setError(err?.data?.message || "Gapni saqlab bo'lmadi."); }
  };

  if (session) return <div className="mx-auto max-w-2xl space-y-4">
    <Button variant="ghost" onClick={() => setSession(null)}><ArrowLeft /> Gaplarga qaytish</Button>
    <PhraseReview phrases={session} finishLabel="Yakunlash" onFinished={() => { setSession(null); refetch(); }} />
  </div>;

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-extrabold">{selectedWord ? `“${selectedWord.word}” qatnashgan gaplar` : 'Mening gaplarim'}</h2>
        <p className="text-sm text-muted-foreground">So&apos;z misollari va saqlagan gaplaringiz. Eshiting, yozing yoki ovoz bilan eslang.</p></div>
      <div className="flex gap-2">
        {due.length > 0 && <Button onClick={() => setSession(due.map(phrase => ({ ...phrase, sourceWord: (phrase.wordLabels || []).join(', '), hint: phrase.text.split(/\s+/).map(word => word[0] + '___').join(' ') })))}><Repeat2 /> Takrorlash</Button>}
        <Button variant="outline" onClick={() => { revisionRef.current++; setLinkedWordId(wordId); setError(''); setOpen(true); }}><Plus /> Gap qo&apos;shish</Button>
      </div>
    </div>
    {wordId && <Button asChild variant="ghost" size="sm"><Link to="/vocabulary?view=phrases">Barcha gaplar</Link></Button>}
    {isLoading ? <Skeleton className="h-40 rounded-2xl" /> : isError ? <EmptyState icon={Quote} title="Gaplarni yuklab bo'lmadi"><Button onClick={refetch}>Qayta urinish</Button></EmptyState> : filtered.length === 0 ? <EmptyState icon={Quote} title="Hali gap saqlanmagan" description="Lug'atdagi tarjimali misollar shu yerga qo'shiladi. O'zingiz ham so'z qatnashgan gap qo'shishingiz mumkin." /> :
      <ul className="grid gap-3 sm:grid-cols-2">{filtered.map(phrase => <li key={phrase._id} className="surface space-y-2 p-4">
        <div className="flex items-start gap-2"><p className="flex-1 text-base font-bold">{phrase.text}</p><Button variant="ghost" size="icon-sm" aria-label={`Gapni eshitish: ${phrase.text}`} onClick={() => playTTSAudio(phrase.text, 'en-GB', 0.9)}><Volume2 /></Button></div>
        <p className="text-sm text-primary">{phrase.textUz}</p>
        {phrase.wordLabels?.length > 0 && <p className="text-xs font-semibold text-muted-foreground">So&apos;z: {phrase.wordLabels.join(', ')}</p>}
        <p className="text-xs text-muted-foreground">{phrase.learned ? 'Yodlangan' : `Bosqich ${phrase.stage || 0}/5 · ${new Date(phrase.nextReviewDate) <= new Date() ? 'Bugun takrorlanadi' : `Keyingi: ${formatUzDate(phrase.nextReviewDate)}`}`}</p>
      </li>)}</ul>}
    <Dialog open={open} onOpenChange={value => { revisionRef.current++; if (!value) speech.stop(); setOpen(value); }}>
      <DialogContent><DialogHeader><DialogTitle>Yangi gap qo&apos;shish</DialogTitle><DialogDescription>Gapni yozing yoki ayting, tarjima qiling va tekshirib saqlang. Til yo&apos;nalishini tugma orqali almashtiring.</DialogDescription></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <label className="block space-y-1 text-sm font-bold"><span>So&apos;zga bog&apos;lash</span><select value={linkedWordId} onChange={event => setLinkedWordId(event.target.value)} disabled={isSaving} className="w-full rounded-xl border border-input bg-background p-3"><option value="">Mustaqil gap</option>{words.map(word => <option key={word._id} value={word._id}>{word.word} — {word.translation}</option>)}</select></label>
          <Button type="button" variant="soft" onClick={() => { revisionRef.current++; setError(''); setSourceLanguage(uzbekFirst ? 'en' : 'uz'); }} disabled={isSaving || speech.listening} aria-label="Tarjima yo'nalishini almashtirish"><ArrowLeftRight /> {uzbekFirst ? "O'zbekcha → Inglizcha" : "Inglizcha → O'zbekcha"}</Button>
          <label className="block space-y-1 text-sm font-bold"><span>{uzbekFirst ? "O'zbekcha gap" : 'Inglizcha gap'}</span><Input value={sourceText} onChange={event => changeSource(event.target.value)} required maxLength={uzbekFirst ? 500 : 400} disabled={isSaving || speech.listening} /></label>
          {speech.supported && <Button type="button" variant="outline" onClick={speech.toggle} disabled={isSaving}>{speech.listening ? <MicOff /> : <Mic />} Gapni aytish</Button>}
          {speech.interim && <p className="text-sm text-muted-foreground">{speech.interim}</p>}
          {speech.error && <p role="alert" className="text-sm text-destructive">{speech.error}</p>}
          <Button type="button" variant="outline" onClick={translate} disabled={isSaving || isTranslating || speech.listening || !sourceText.trim()}>{isTranslating ? <Loader2 className="animate-spin" /> : <Languages />} Tarjima qilish</Button>
          <label className="block space-y-1 text-sm font-bold"><span>{uzbekFirst ? 'Inglizcha tarjima' : "Gapning o'zbekcha tarjimasi"}</span><Input value={uzbekFirst ? text : textUz} onChange={event => changeTarget(event.target.value)} required maxLength={uzbekFirst ? 400 : 500} disabled={isSaving || speech.listening} /></label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={isSaving || isTranslating || speech.listening || !text.trim() || !textUz.trim()}>{isSaving ? <Loader2 className="animate-spin" /> : <Plus />} Saqlash va takrorlash</Button>
        </form>
      </DialogContent>
    </Dialog>
  </div>;
};

export default PhraseLibrary;
