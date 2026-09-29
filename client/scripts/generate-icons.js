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
//
// Ilovadagi `LogoMark` (src/components/brand/Logo.jsx) bilan bir xil shakl:
// binafsha gradient fonda oq suhbat pufakchasi, ichida "L" va nuqta.
// Koordinatalar SVG'dagi 40×40 viewBox birligida. Chekkalar silliq bo'lishi
// uchun har piksel 4×4 nuqtada o'lchanadi (supersampling).

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const GRAD_FROM = hex('#6d4df2');
const GRAD_TO = hex('#b23ad8');

const mix = (a, b, t) => a + (b - a) * t;
const gradientAt = (u, v) => {
  const t = Math.min(1, Math.max(0, (u + v) / 80));
  return [mix(GRAD_FROM[0], GRAD_TO[0], t), mix(GRAD_FROM[1], GRAD_TO[1], t), mix(GRAD_FROM[2], GRAD_TO[2], t)];
};

/** Yumaloq to'rtburchakgacha ishorali masofa (ichida manfiy) */
const sdRoundRect = (px, py, x0, y0, x1, y1, r) => {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const qx = Math.abs(px - cx) - ((x1 - x0) / 2 - r);
  const qy = Math.abs(py - cy) - ((y1 - y0) / 2 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};

const distToSegment = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

const inTriangle = (px, py, [ax, ay], [bx, by], [cx, cy]) => {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
};

/**
 * Logo nuqtasidagi rang (u, v — 0..40).
 * @returns {[number, number, number, number]} RGBA, alfa 0..1
 */
const sampleLogo = (u, v, fullBleed) => {
  if (!fullBleed && sdRoundRect(u, v, 0, 0, 40, 40, 12) > 0) return [0, 0, 0, 0];

  let [r, g, b] = gradientAt(u, v);

  // Yuqori qismda yengil yaltiroq (SVG'dagi "sh" gradienti)
  if (v < 20) {
    const k = 0.28 * (1 - v / 20);
    r = mix(r, 255, k);
    g = mix(g, 255, k);
    b = mix(b, 255, k);
  }

  const inBubble =
    sdRoundRect(u, v, 8.5, 10.5, 31.5, 26.5, 4) <= 0 ||
    inTriangle(u, v, [13.8, 26], [20.5, 26], [13.8, 30.8]);

  if (inBubble) {
    const inL =
      distToSegment(u, v, 16.2, 14.6, 16.2, 21.8) <= 1.5 ||
      distToSegment(u, v, 16.2, 21.8, 23.8, 21.8) <= 1.5;
    const inDot = Math.hypot(u - 25.4, v - 15.4) <= 1.7;
    if (!inL && !inDot) return [255, 255, 255, 1];
    const [gr, gg, gb] = gradientAt(u, v);
    return [gr, gg, gb, 1];
  }

  return [r, g, b, 1];
};

/**
 * @param {number} size
 * @param {boolean} maskable  Android maskable / iOS ikonka: fon butun kvadratni
 *   to'ldiradi (tizim o'zi kesadi), belgi esa markazdagi xavfsiz zonada.
 */
const drawIcon = (size, maskable = false) => {
  const px = new Uint8Array(size * size * 4);
  const SS = 4; // supersampling
  // Maskable: muhim qism markazdagi 80% doiraga sig'ishi kerak
  const contentScale = maskable ? 0.78 : 1;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = ((x + (sx + 0.5) / SS) / size) * 40;
          const fy = ((y + (sy + 0.5) / SS) / size) * 40;
          const u = 20 + (fx - 20) / contentScale;
          const v = 20 + (fy - 20) / contentScale;
          const [cr, cg, cb, ca] = sampleLogo(u, v, maskable);
          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          a += ca;
        }
      }
      const i = (y * size + x) * 4;
      const n = SS * SS;
      px[i] = a ? Math.round(r / a) : 0;
      px[i + 1] = a ? Math.round(g / a) : 0;
      px[i + 2] = a ? Math.round(b / a) : 0;
      px[i + 3] = Math.round((a / n) * 255);
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
