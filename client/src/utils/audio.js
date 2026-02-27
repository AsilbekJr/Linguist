// client/src/utils/audio.js

let voicesCache = [];

const loadVoices = () => {
    voicesCache = window.speechSynthesis.getVoices();
};

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
    }
}

export const getBestVoice = (lang = 'en') => {
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

export const playTTSAudio = (text, lang = 'en-US', rate = 0.85) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    // Mobile Safari hack: using cancel() immediately before speak() can silently fail
    // Using a tiny timeout fixes the race condition on iOS/Mobile Safari
    window.speechSynthesis.cancel();
    
    setTimeout(() => {
        // Clean text from markdown asterisks if any
        const cleanText = text.replace(/\*\*/g, '');
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
};
