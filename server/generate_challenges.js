const fs = require('fs');
const path = require('path');

const TOPICS = [
    "A Memorable Travel Experience", "The Future of Technology", "A Book or Movie That Changed My Life",
    "The Importance of Mental Health", "My Dream Career", "Cultural Differences I've Noticed",
    "The Best Advice I've Ever Received", "How I Deal with Stress", "A Challenge I Overcame",
    "The Role of Social Media Today", "If I Could Meet Anyone from History", "The Most Delicious Meal I've Had",
    "A Skill I Want to Learn", "My Favorite Childhood Memory", "The Impact of Artificial Intelligence",
    "Climate Change and Us", "Why Sleep is Important", "My Fitness Journey", "The Value of Friendship",
    "Living in a Big City vs. Countryside"
];

const challenges = [];

for (let i = 1; i <= 100; i++) {
    const topic = TOPICS[(i - 1) % TOPICS.length];
    
    // Create text based on the day (length increases)
    const minWords = Math.min(20 + (i * 1.5), 180);
    const maxWords = minWords + 30;
    
    // Generate some procedural English text content that looks like a story/essay
    let text = `Welcome to day ${i} of your challenge! Today's topic is: ${topic}. `;
    if (i < 20) {
        text += `This is a short introductory reading. The world is full of interesting things. We must always keep learning. Focus on your pronunciation and fluidity. Practice makes perfect. `;
    } else if (i < 50) {
        text += `As you progress, the readings become slightly more complex. When thinking about this topic, it's important to consider various perspectives. Experiences shape who we are. Continue to build your vocabulary and pay attention to sentence structure. Remember that consistency is the key to success in language learning. Keep up the great work! `;
    } else if (i < 80) {
        text += `You are now in the advanced stages of the challenge. Exploring this topic requires deeper thought and more sophisticated language. Notice how different arguments can be constructed. By now, your fluency should have improved significantly. Do not shy away from using complex grammar or new idioms. It is through these challenges that real growth occurs. `;
    } else {
        text += `You have almost reached the end of the 100 days! This topic represents a culmination of your efforts. The ability to articulate complex thoughts on such matters is a testament to your hard work. Reflect on how far you have come since day one. The vocabulary you use now is richer, and your comprehension is much sharper. Finish strong! `;
    }
    
    text += `(Target words will be dynamically injected here in the route).`;

    challenges.push({
        dayNumber: i,
        topic: topic,
        textTemplate: text
    });
}

// Create the data directory if it doesn't exist
const dir = path.join(__dirname, 'data');
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(path.join(dir, 'challenges.json'), JSON.stringify(challenges, null, 2));
console.log("challenges.json generated successfully.");
