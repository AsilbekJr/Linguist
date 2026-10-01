import test from 'node:test';
import assert from 'node:assert/strict';

import { maskLine, MANDATORY_ROUNDS, LAST_ROUND } from '../src/utils/memorize.js';

const LINE = 'Do I have to get a prescription?';
const view = (parts) => parts.map((p) => p.text).join(' ');

test("1-davra: gap to'liq ko'rinadi", () => {
  assert.equal(view(maskLine(LINE, 1, ['prescription'])), LINE);
});

test("2-davra: bugungi so'z yashirinadi, tinish belgisi qoladi", () => {
  const parts = maskLine(LINE, 2, ['prescription']);
  const last = parts[parts.length - 1];
  assert.equal(last.hidden, true);
  assert.ok(last.text.endsWith('?'), 'savol belgisi saqlanishi kerak');
  assert.ok(!view(parts).includes('prescription'));
  // Qisqa yordamchi so'zlar ko'rinib turadi — gap tuzilishi tanilsin
  assert.ok(view(parts).startsWith('Do I'));
});

test("2-davra: so'z shakli ham taniladi (symptom → symptoms)", () => {
  const parts = maskLine('How long have you had these symptoms?', 2, ['symptom']);
  assert.ok(!view(parts).includes('symptoms'));
});

test("2-davra: bugungi so'z bo'lmasa ham kamida bitta so'z yashirinadi", () => {
  const parts = maskLine('Yes, I am.', 2, []);
  assert.ok(parts.some((p) => p.hidden));
});

test('3-davra: faqat birinchi harflar', () => {
  // Bir harfli so'zlar ("I", "a") o'zgarmaydi; uzun so'z chizig'i 9 tadan oshmaydi
  assert.equal(view(maskLine(LINE, 3, [])), 'D_ I h___ t_ g__ a p_________?');
});

test("4-davra: hammasi yashirin", () => {
  assert.ok(maskLine(LINE, 4, []).every((p) => p.hidden));
});

test('2 ta majburiy davra, jami 4 ta', () => {
  assert.equal(MANDATORY_ROUNDS, 2);
  assert.equal(LAST_ROUND, 4);
});
