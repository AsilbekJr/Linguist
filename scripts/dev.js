#!/usr/bin/env node
/**
 * Ikkala serverni bitta buyruq bilan ko'taradi va telefonda sinash uchun
 * kerakli manzillarni chiqaradi.
 *
 *   node scripts/dev.js
 *
 * Dependency qo'shilmagan (`concurrently` kerak emas) — child_process yetarli.
 */

const { spawn } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const root = path.join(__dirname, '..');
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';

/** Lokal tarmoqdagi IPv4 manzil */
const lanAddress = () => {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
};

const color = (code, text) => `\x1b[${code}m${text}\x1b[0m`;
const dim = (t) => color(2, t);
const bold = (t) => color(1, t);
const green = (t) => color(32, t);
const yellow = (t) => color(33, t);

// ─── Tekshiruvlar ──────────────────────────────────────────────────────────

const serverEnv = path.join(root, 'server', '.env');
if (!fs.existsSync(serverEnv)) {
  console.error(yellow('\nserver/.env topilmadi.'));
  console.error(dim('  cp server/.env.example server/.env  — keyin MONGO_URI va JWT_SECRET ni to\'ldiring\n'));
  process.exit(1);
}

// ─── Jarayonlar ────────────────────────────────────────────────────────────

const children = [];

const run = (name, cwd, args, colorCode) => {
  const child = spawn(npm, args, {
    cwd: path.join(root, cwd),
    shell: isWindows,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const prefix = color(colorCode, `[${name}]`);
  const pipe = (stream) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (line.trim()) console.log(`${prefix} ${line}`);
      }
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);

  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`${prefix} ${yellow(`kod ${code} bilan to'xtadi`)}`);
    }
    shutdown();
  });

  children.push(child);
  return child;
};

let shuttingDown = false;
const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    try {
      child.kill();
    } catch {
      // allaqachon to'xtagan
    }
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ─── Ishga tushirish ───────────────────────────────────────────────────────

run('server', 'server', ['run', 'dev'], 36);
// `--host` — lokal tarmoqdan (telefondan) kirish uchun
run('client', 'client', ['run', 'dev', '--', '--host'], 35);

const ip = lanAddress();

setTimeout(() => {
  console.log(bold('\n─────────────────────────────────────────────────────────'));
  console.log(bold('  Manzillar'));
  console.log(`  Kompyuterda:  ${green('http://localhost:5173')}`);
  if (ip) {
    console.log(`  Telefonda:    ${green(`http://${ip}:5173`)}   ${dim('(bir xil Wi-Fi)')}`);
  }
  console.log('');
  console.log(yellow('  PWA va bildirishnomani telefonda sinash uchun:'));
  console.log(dim('  http:// manzilda service worker ISHLAMAYDI (xavfsiz kontekst emas).'));
  console.log(dim('  Chrome USB orqali port forwarding qiling — telefon uni'));
  console.log(dim('  localhost deb ko\'radi va PWA to\'liq ishlaydi:'));
  console.log('');
  console.log(dim('    1. Telefonda: Sozlamalar → Developer options → USB debugging'));
  console.log(dim('    2. Kompyuterda Chrome: chrome://inspect/#devices'));
  console.log(dim('    3. "Port forwarding" → 5173 → localhost:5173  (Enable)'));
  console.log(dim('    4. Telefon Chrome\'da: http://localhost:5173'));
  console.log(bold('─────────────────────────────────────────────────────────\n'));
}, 2500);
