const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFrom, passwordResetEmail } = require('../services/mailer');

/**
 * MAIL_FROM dashboard'ga turlicha yoziladi. Ilgari faqat `Nom <email>`
 * shakli ishlardi, qolganlarida Brevo "valid sender email required" berardi.
 */
test('MAIL_FROM ning keng tarqalgan shakllari to\'g\'ri ajratiladi', () => {
  const cases = [
    ['Linguist AI <ali@gmail.com>', 'Linguist AI', 'ali@gmail.com'],
    ['"Linguist AI <ali@gmail.com>"', 'Linguist AI', 'ali@gmail.com'],
    ['"Linguist AI" <ali@gmail.com>', 'Linguist AI', 'ali@gmail.com'],
    ['Linguist AI < ali@gmail.com >', 'Linguist AI', 'ali@gmail.com'],
    ['ali@gmail.com', 'Linguist AI', 'ali@gmail.com'],
    ['  ali@gmail.com  ', 'Linguist AI', 'ali@gmail.com'],
    ['Linguist AI ali@gmail.com', 'Linguist AI', 'ali@gmail.com'],
  ];
  for (const [raw, name, email] of cases) {
    assert.deepEqual(parseFrom(raw), { name, email }, raw);
  }
});

test('emailsiz MAIL_FROM aniqlanadi', () => {
  assert.equal(parseFrom('Linguist AI').email, null);
  assert.equal(parseFrom('').email, null);
});

test('foydalanuvchi ismi xat HTML\'ida ekranlanadi', () => {
  const mail = passwordResetEmail('<a href="https://evil.example">x</a>', 'https://app.uz/r?token=1&b=2');
  assert.ok(!mail.html.includes('<a href="https://evil.example"'));
  assert.ok(mail.html.includes('&lt;a href='));
});
