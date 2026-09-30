const mongoose = require('mongoose');

const wordSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    word: {
        type: String,
        required: true
    },
    /** Duplikat tekshiruvi va qidiruv uchun normallashtirilgan shakl */
    wordKey: {
        type: String,
        index: true
    },
    phonetic: String,
    definition: String,
    translation: String,
    partOfSpeech: String,
    synonyms: [String],
    examples: [String],
    /**
     * Misol gapning o'zbekcha tarjimasi.
     * Boshlang'ich daraja uchun misol tarjimasiz deyarli foydasiz —
     * o'quvchi gapni tushunmasa, u shunchaki inglizcha matn bo'lib qoladi.
     */
    exampleUz: String,
    collocations: [String],
    imageUrl: String,
    /** CEFR darajasi — kontent bazasidan keladi */
    cefr: {
        type: String,
        enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', null],
        default: null
    },

    // ─── Takrorlash holati (utils/srs.js) ────────────────────────────────────
    /**
     * Joriy bosqich, 0..7. Har bosqich o'z intervaliga ega:
     * 1→1 kun, 2→2, 3→4, 4→7, 5→14, 6→30, 7→60.
     */
    stage: {
        type: Number,
        default: 0,
        min: 0,
        max: 7
    },
    /**
     * 7-bosqichdan o'tgan so'z. Takrorlash navbatiga tushmaydi, lekin
     * lug'atda ko'rinadi va qo'lda qayta yodlashga qaytarilishi mumkin.
     */
    learned: {
        type: Boolean,
        default: false,
        index: true
    },
    learnedAt: Date,
    /** Foydalanuvchi "Bilaman" deb o'zi belgilagan (takrorlab yodlamagan) */
    markedKnown: {
        type: Boolean,
        default: false
    },
    /**
     * Eski SM-2 maydoni. Endi ishlatilmaydi — hisob-kitob qat'iy bosqichlar
     * bo'yicha boradi. Mavjud hujjatlarni buzmaslik uchun sxemada qoldirilgan.
     */
    easeFactor: {
        type: Number,
        default: 2.5
    },
    /** Joriy takrorlash oralig'i, kunlarda */
    intervalDays: {
        type: Number,
        default: 0
    },
    /** Eski maydon — `stage` bilan sinxron yuritiladi */
    repetitions: {
        type: Number,
        default: 0
    },
    /** Necha marta unutilgan — qiyin so'zlarni aniqlash uchun */
    lapses: {
        type: Number,
        default: 0
    },
    lastReviewedAt: Date,

    /** Eski nom — `learned` bilan bir xil, mavjud mijozlar uchun sinxron yuritiladi */
    mastered: {
        type: Boolean,
        default: false
    },
    /** Eski maydon — `stage` bilan sinxron yuritiladi */
    reviewStage: {
        type: Number,
        default: 0
    },
    nextReviewDate: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Bir foydalanuvchida bitta so'z faqat bir marta — duplikat poygasini DB darajasida to'xtatadi
wordSchema.index({ user: 1, wordKey: 1 }, { unique: true, sparse: true });
wordSchema.index({ user: 1, createdAt: -1 });
// Takrorlash navbati uchun asosiy indeks. `learned` ham kiradi — yodlangan
// so'zlar navbatdan chiqariladi va ularsiz skan qilish kerak emas.
wordSchema.index({ user: 1, learned: 1, nextReviewDate: 1 });

wordSchema.pre('validate', function () {
    if (this.word) {
        this.wordKey = String(this.word).trim().toLowerCase();
    }
});

module.exports = mongoose.model('Word', wordSchema);
