const mongoose = require('mongoose');
const Word = require('./models/Word');
const dotenv = require('dotenv');

dotenv.config();

const findWord = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const word = await Word.findOne({ word: { $regex: new RegExp("^persistence$", "i") } });
        if (word) {
            console.log(word._id.toString());
        } else {
            console.log("Word not found");
        }
        process.exit();
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

findWord();
