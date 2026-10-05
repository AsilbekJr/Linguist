// client/src/utils/audio.js

let voicesCache = [];
let pendingSpeech = null;
let playbackId = 0;

const loadVoices = () => {
    voicesCache = window.speechSynthesis.getVoices();
};

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    loadVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

export const getBestVoice = (lang = 'en') => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;
    if (!voicesCache.length) {
        voicesCache = window.speechSynthesis.getVoices();
    }
    
    if (!voicesCache.length) return null;
    
    const targetVoices = voicesCache.filter(v => v.lang.startsWith(lang));
    
    if (lang === 'en') {
        const preferredVoices = [
            'Google UK English Female',
            'Google UK English Male',
            'Google US English',
            'Microsoft Sonia Online',
            'Microsoft Aria Online',
            'Microsoft Guy Online',
            'Samantha', 
            'Daniel',   
            'Alex'
        ];

        for (const pref of preferredVoices) {
            const match = targetVoices.find(v => v.name.includes(pref));
            if (match) return match;
        }
    }
    
    return targetVoices[0] || voicesCache[0];
};

export const stopTTSAudio = () => {
    clearTimeout(pendingSpeech);
    pendingSpeech = null;
    playbackId += 1;
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
};

export const playTTSAudio = (text, lang = 'en-US', rate = 0.85) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const cleanText = String(text || '').replace(/\*\*/g, '').trim();
    if (!cleanText) return;

    // Mobile Safari hack: using cancel() immediately before speak() can silently fail
    // Using a tiny timeout fixes the race condition on iOS/Mobile Safari
    stopTTSAudio();
    const id = playbackId;
    
    pendingSpeech = setTimeout(() => {
        pendingSpeech = null;
        const msg = new SpeechSynthesisUtterance(cleanText);
        msg.lang = lang;
        msg.rate = rate;

        const langPrefix = lang.split('-')[0];
        const bestVoice = getBestVoice(langPrefix);
        if (bestVoice) {
            msg.voice = bestVoice;
        }

        window.speechSynthesis.speak(msg);
    }, 50);
    // Effect cleanup must only cancel the playback it started.
    return () => { if (id === playbackId) stopTTSAudio(); };
};
