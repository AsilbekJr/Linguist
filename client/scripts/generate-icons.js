#!/usr/bin/env node
/**
 * PWA ikonkalarini generatsiya qiladi.
 *
 * Nega qo'lda: `sharp` yoki `canvas` kabi paket qo'shish shunchaki bir necha
 * statik PNG uchun ortiqcha — ular native binary olib keladi va CI'da
 * o'rnatishni sekinlashtiradi. PNG formati esa zlib (Node'da bor) va CRC32
 * bilan bemalol yoziladi.
 *
 *   npm run icons
 */

import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── PNG yozuvchi ──────────────────────────────────────────────────────────

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** @param {Uint8Array} rgba  width*height*4 */
const encodePng = (rgba, width, height) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // no interlace

  // Har bir qatordan oldin filtr bayti (0 = None)
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * width * 4, width * 4).copy(
      raw,
      y * (width * 4 + 1) + 1
    );
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// ─── Ikonka chizish ────────────────────────────────────────────────────────

const lerp = (a, b, t) => Math.round(a + (b - a) * t);

/**
 * Binafsha→pushti gradient fonda oq "L" harfi.
 *
 * @param {number} size
 * @param {boolean} maskable  Android maskable ikonka: muhim qism markazdagi
 *   80% doiraga sig'ishi kerak, aks holda tizim uni kesib tashlaydi.
 */
const drawIcon = (size, maskable = false) => {
  const px = new Uint8Array(size * size * 4);
  // Maskable uchun harfni kichraytiramiz — chekkalar kesilishi mumkin
  const scale = maskable ? 0.52 : 0.68;
  const radius = maskable ? 0 : size * 0.22; // maskable to'liq to'ldiriladi

  const barW = size * scale * 0.26;
  const letterH = size * scale;
  const letterW = size * scale * 0.72;
  const x0 = (size - letterW) / 2;
  const y0 = (size - letterH) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Diagonal gradient: #6d28d9 → #db2777
      const t = (x / size + y / size) / 2;
      let r = lerp(0x6d, 0xdb, t);
      let g = lerp(0x28, 0x27, t);
      let b = lerp(0xd9, 0x77, t);
      let a = 255;

      // Yumaloq burchaklar (maskable bo'lmaganda)
      if (radius > 0) {
        const cx = Math.min(x, size - 1 - x);
        const cy = Math.min(y, size - 1 - y);
        if (cx < radius && cy < radius) {
          const dx = radius - cx;
          const dy = radius - cy;
          if (Math.sqrt(dx * dx + dy * dy) > radius) a = 0;
        }
      }

      // "L" harfi: vertikal ustun + pastki gorizontal
      const inVertical = x >= x0 && x < x0 + barW && y >= y0 && y < y0 + letterH;
      const inHorizontal =
        x >= x0 && x < x0 + letterW && y >= y0 + letterH - barW && y < y0 + letterH;

      if (a > 0 && (inVertical || inHorizontal)) {
        r = 255;
        g = 255;
        b = 255;
      }

      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = a;
    }
  }

  return encodePng(px, size, size);
};

// ─── Yozish ────────────────────────────────────────────────────────────────

const outDir = path.join(__dirname, '../public');
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: true },
];

for (const { file, size, maskable } of targets) {
  const buf = drawIcon(size, maskable);
  fs.writeFileSync(path.join(outDir, file), buf);
  console.log(`  ${file.padEnd(26)} ${size}×${size}  ${(buf.length / 1024).toFixed(1)} KB`);
}

// Favicon — brauzer yorlig'i uchun kichik variant
fs.writeFileSync(path.join(outDir, 'favicon.png'), drawIcon(48, false));
console.log(`  ${'favicon.png'.padEnd(26)} 48×48`);
console.log('\n✓ Ikonkalar tayyor\n');
