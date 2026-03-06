const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();

connectDB();

const wordRoutes = require('./routes/wordRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const speakingRoutes = require('./routes/speakingRoutes');
const roleplayRoutes = require('./routes/roleplayRoutes');
const challengeRoutes = require('./routes/challengeRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();

const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({
    origin: allowedOrigin
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.get('/', (req, res) => {
    res.send('Linguist AI-Flow API is running (Mock Mode Available)...');
});

app.use('/api/words', wordRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/speaking', speakingRoutes);
app.use('/api/roleplay', roleplayRoutes);
app.use('/api/challenge', challengeRoutes);
app.use('/api/topics', require('./routes/topicVocabRoutes'));
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
