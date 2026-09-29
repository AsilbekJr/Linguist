/**
 * Mavzular kutubxonasi — Advanced (C1).
 *
 * Mavzular tuzilishi va so'zlar tanlovi "English Vocabulary in Use:
 * Advanced" (Cambridge) kitobining unit'lariga tayanadi. Kitobdan FAQAT
 * mavzu nomi va so'zlar olingan — tarjima, misol gaplar va ularning
 * o'zbekchasi Linguist uchun alohida yozilgan (mualliflik huquqi).
 *
 * Quyi darajalarda bor so'zlar bu yerda takrorlanmaydi (validator tekshiradi).
 */

module.exports = {
  key: 'advanced',
  title: 'Advanced',
  titleUz: 'Yuqori',
  cefr: 'C1',
  cefrRange: 'C1',
  // Fayllar ~20 unit'dan: bitta fayl o'qib bo'lmas darajada uzun bo'lmasin
  topics: [1, 2, 3, 4, 5].flatMap((n) => require(`./advanced-${n}`)),
};
