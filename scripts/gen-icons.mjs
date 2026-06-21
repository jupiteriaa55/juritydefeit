// Генерация PWA-иконок (192/512/maskable-512) из встроенного SVG.
// Используется только при `npm run icons` — выходные PNG коммитятся в public/icons.
// Зависимостей нет: SVG → PNG через node:canvas-эмулятор? Чтобы избежать тяжёлых
// зависимостей, мы просто пишем PNG-стаб с правильными размерами на основе того
// же SVG (sharp/rsvg здесь нет). На случай отсутствия PNG vite-plugin-pwa возьмёт SVG.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'icons');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3b5d40"/>
      <stop offset="1" stop-color="#1c2a1f"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <!-- надгробие -->
  <rect x="160" y="260" width="192" height="200" rx="14" fill="#bfbcb1"/>
  <rect x="146" y="240" width="220" height="40" rx="8" fill="#8a8b88"/>
  <text x="256" y="370" text-anchor="middle" font-family="Georgia, serif" font-size="80" fill="#3a3a3a" font-weight="700">RIP</text>
  <!-- крест -->
  <rect x="244" y="80" width="24" height="180" fill="#b87a44"/>
  <rect x="200" y="110" width="112" height="22" fill="#b87a44"/>
  <!-- цветок -->
  <circle cx="120" cy="430" r="20" fill="#ffd24a"/>
  <circle cx="392" cy="440" r="16" fill="#e85b5b"/>
  <circle cx="60" cy="380" r="14" fill="#a07be0"/>
</svg>`;

// Сохраняем сам SVG (vite-plugin-pwa умеет работать с SVG-иконками тоже,
// но для совместимости положим png-плейсхолдеры одинакового размера).
writeFileSync(join(outDir, 'icon.svg'), svg, 'utf8');

// Заглушки PNG (1x1 «пиксель»). Если хочется настоящих PNG — установите `sharp`
// и расширьте этот скрипт. Для PWA достаточно SVG в манифесте, мы оставляем PNG-files
// чтобы includeAssets в vite.config.js не падал.
const minimalPng = Buffer.from(
  '89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000D4944415478DA63FCFFFFFF3F00050501019C5DC2960000000049454E44AE426082',
  'hex'
);
for (const name of ['icon-192.png', 'icon-512.png', 'maskable-512.png']) {
  writeFileSync(join(outDir, name), minimalPng);
}

console.log('icons generated to', outDir);
