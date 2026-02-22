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

export const groupWordsByReviewInterval = (words) => {
    if (!Array.isArray(words)) return {};

    const groups = {
        "Review Now ⚡": [],
        "Tomorrow 🌅": [],
        "In 3 Days 🗓️": [],
        "In 1 Week 📅": [],
        "Mastered 🏆": [] // Added mastered group just in case
    };

    const now = new Date();
    // Normalize now to start of day for easier day-based grouping if desired, 
    // but the backend stores precise timestamps.
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    words.forEach(word => {
        if (word.mastered) {
             groups["Mastered 🏆"].push(word);
             return;
        }

        const reviewDate = new Date(word.nextReviewDate || Date.now());
        
        // Calculate diff in days
        const diffTime = reviewDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) {
            groups["Review Now ⚡"].push(word);
        } else if (diffDays === 1) {
            groups["Tomorrow 🌅"].push(word);
        } else if (diffDays <= 3) {
            groups["In 3 Days 🗓️"].push(word);
        } else {
            groups["In 1 Week 📅"].push(word);
        }
    });

    // Remove empty groups
    return Object.fromEntries(Object.entries(groups).filter(([_, groupWords]) => groupWords.length > 0));
};
