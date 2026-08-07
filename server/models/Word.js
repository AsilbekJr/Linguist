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
    collocations: [String],
    imageUrl: String,
    /** CEFR darajasi — kontent bazasidan keladi */
    cefr: {
        type: String,
        enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', null],
        default: null
    },

    // ─── SM-2 holati (utils/srs.js) ──────────────────────────────────────────
    /** Qiyinlik koeffitsienti — har so'z uchun individual */
    easeFactor: {
        type: Number,
        default: 2.5
    },
    /** Joriy takrorlash oralig'i, kunlarda */
    intervalDays: {
        type: Number,
        default: 0
    },
    /** Ketma-ket muvaffaqiyatli takrorlashlar soni */
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

    /**
     * Endi "takrorlashdan chiqarish" degani EMAS — shunchaki interval 180 kundan
     * oshganini bildiruvchi yorliq. So'z baribir vaqti kelganda qaytadi.
     */
    mastered: {
        type: Boolean,
        default: false
    },
    /** Eski maydon — mavjud UI shunga qaraydi, srs.js repetitions bilan sinxronlaydi */
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
// Takrorlash navbati uchun asosiy indeks
wordSchema.index({ user: 1, nextReviewDate: 1 });

wordSchema.pre('validate', function () {
    if (this.word) {
        this.wordKey = String(this.word).trim().toLowerCase();
    }
});

module.exports = mongoose.model('Word', wordSchema);
