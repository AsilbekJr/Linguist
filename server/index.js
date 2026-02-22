const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();

connectDB();

const wordRoutes = require('./routes/wordRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const speakingRoutes = require('./routes/speakingRoutes');

const app = express();

const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({
    origin: allowedOrigin
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Linguist AI-Flow API is running (Mock Mode Available)...');
});

app.use('/api/words', wordRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api/speaking', speakingRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
