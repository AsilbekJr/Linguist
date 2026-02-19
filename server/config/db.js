const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            console.log('No MONGO_URI found. Mock Database Mode enabled.');
            return;
        }
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.warn(`MongoDB Connection Error: ${error.message}`);
        console.log('Falling back to Mock Database Mode.');
        // process.exit(1); // Do not exit, allow app to run in mock mode
    }
};

module.exports = connectDB;
