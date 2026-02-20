export const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    }).format(date);
};

export const groupWordsByDate = (words) => {
    if (!Array.isArray(words)) return {};

    const groups = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isSameDay = (d1, d2) => {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    };

    // Sort by date descending (newest first)
    const sortedWords = [...words].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    sortedWords.forEach(word => {
        const wordDate = new Date(word.createdAt || Date.now()); // Fallback to now if missing
        
        let label = formatDate(wordDate);

        if (isSameDay(wordDate, today)) {
            label = "Today 🌟";
        } else if (isSameDay(wordDate, yesterday)) {
            label = "Yesterday ⏳";
        }

        if (!groups[label]) {
            groups[label] = [];
        }
        groups[label].push(word);
    });

    return groups;
};
