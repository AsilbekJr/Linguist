const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

dotenv.config();

connectDB();

const app = express();

const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({
    origin: allowedOrigin
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Linguist AI-Flow API is running (Mock Mode Available)...');
});

app.use('/api/words', require('./routes/wordRoutes'));
app.use('/api/stories', require('./routes/storyRoutes'));
app.use('/api/review', require('./routes/reviewRoutes'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
