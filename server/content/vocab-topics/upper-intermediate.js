/**
 * Mavzular kutubxonasi — Upper-intermediate (B2).
 *
 * Mavzular tuzilishi va so'zlar tanlovi "English Vocabulary in Use:
 * Upper-intermediate" (Cambridge) kitobining unit'lariga tayanadi. Kitobdan
 * FAQAT mavzu nomi va so'zlar olingan — tarjima, misol gaplar va ularning
 * o'zbekchasi Linguist uchun alohida yozilgan (mualliflik huquqi).
 *
 * Elementary'da bor so'zlar bu yerda takrorlanmaydi: lug'atda bir so'z bitta
 * yozuv, kutubxonada esa u o'zi birinchi uchragan darajada turadi.
 */

module.exports = {
  key: 'upper-intermediate',
  title: 'Upper-intermediate',
  titleUz: "O'rta-yuqori",
  cefr: 'B2',
  cefrRange: 'B2',
  // Fayllar ~20 unit'dan: bitta fayl o'qib bo'lmas darajada uzun bo'lmasin
  topics: [1, 2, 3, 4, 5, 6].flatMap((n) => require(`./upper-intermediate-${n}`)),
};
