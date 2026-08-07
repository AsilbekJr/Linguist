#!/usr/bin/env node
/**
 * VAPID kalitlarini generatsiya qiladi.
 *
 *   npm run push:keys
 *
 * Kalitlar BIR MARTA generatsiya qilinadi va o'zgartirilmaydi: ochiq kalit
 * brauzerdagi obunaga "muhrlanadi". Uni almashtirish barcha mavjud
 * obunalarni bekor qiladi va foydalanuvchilar qayta ruxsat berishi kerak
 * bo'ladi.
 */

const webpush = require('web-push');

const keys = webpush.generateVAPIDKeys();

console.log('\nVAPID kalitlari generatsiya qilindi.');
console.log('Quyidagilarni server/.env ga (va Render Environment ga) qo\'shing:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:sizning@email.uz');
console.log('\nMijozga ham ochiq kalit kerak (client/.env):');
console.log(`VITE_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(
  '\nDIQQAT: maxfiy kalitni hech qachon mijozga yoki repozitoriyga qo\'ymang.'
);
console.log(
  'Kalitlarni keyinchalik almashtirish barcha obunalarni bekor qiladi.\n'
);
