// Качественные мультяшные процедурные текстуры через Canvas2D.
// Все текстуры генерируются в коде (не нужны внешние ассеты, всё работает офлайн).
// Стиль — «hand-painted»: яркие цвета, мягкие края, чёткие крупные пятна,
// на каждой текстуре имитируем запечённое освещение для объёмности без шейдеров.

import * as THREE from 'three';

const cache = new Map();

function makeCanvas(size = 512) {
  const c = (typeof OffscreenCanvas !== 'undefined')
    ? new OffscreenCanvas(size, size)
    : Object.assign(document.createElement('canvas'), { width: size, height: size });
  return c;
}

// PRNG (детерминирован) — текстуры одинаковые между запусками.
function rand(seed) {
  let s = seed | 0;
  return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) % 100000) / 100000; };
}

function toTexture(canvas, opts = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = opts.repeat !== false ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

// Рисует «листики» травы — пучки штрихов, направленные вверх с лёгким разбросом.
function drawGrassBlades(ctx, w, h, count, palette, length = 6) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const len = length * (0.7 + Math.random() * 0.6);
    const tilt = (Math.random() - 0.5) * 1.6;
    const c = palette[(Math.random() * palette.length) | 0];
    ctx.strokeStyle = c;
    ctx.lineWidth = 1 + Math.random() * 0.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + tilt, y - len);
    ctx.stroke();
  }
}

// ---------- генераторы ----------

function texGrass() {
  const c = makeCanvas(512);
  const ctx = c.getContext('2d');
  // Базовый «нарисованный» зелёный с лёгким градиентом сверху-вниз.
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, '#8acf6c');
  grad.addColorStop(0.5, '#6db452');
  grad.addColorStop(1, '#549a3f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);

  // Пятна разных оттенков (имитация залитых акварельных пятен).
  const patches = [
    'rgba(120,180,90,0.45)', 'rgba(60,110,55,0.35)',
    'rgba(180,210,140,0.30)', 'rgba(40,80,40,0.30)',
  ];
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    const r = 18 + Math.random() * 80;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, patches[i % patches.length]);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // Травинки — штриховой слой.
  drawGrassBlades(ctx, c.width, c.height, 1400,
    ['rgba(40,80,35,0.7)', 'rgba(70,120,55,0.7)', 'rgba(110,170,80,0.55)'], 7);
  drawGrassBlades(ctx, c.width, c.height, 700,
    ['rgba(180,220,140,0.55)', 'rgba(220,240,170,0.45)'], 5);

  // Редкие цветочки.
  const flowerColors = ['#ffd24a', '#ffffff', '#ff7a7a', '#c388ff', '#7adcff'];
  for (let i = 0; i < 28; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    ctx.fillStyle = flowerColors[(Math.random() * flowerColors.length) | 0];
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 2, y + Math.sin(a) * 2, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff3a8';
    ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
  }

  // Лёгкая виньетка по краям (имитация тени от стилизации).
  const v = ctx.createRadialGradient(c.width / 2, c.height / 2, c.width * 0.3, c.width / 2, c.height / 2, c.width * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, c.width, c.height);

  return c;
}

function texDirt() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  // Глубокая тёплая земля.
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, '#8a5a30');
  grad.addColorStop(0.5, '#6b4220');
  grad.addColorStop(1, '#4a2c14');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);

  // Комочки земли.
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    const r = 1 + Math.random() * 4;
    ctx.fillStyle = `rgba(${30 + Math.random() * 30 | 0},${15 + Math.random() * 20 | 0},${5 + Math.random() * 10 | 0},${0.5 + Math.random() * 0.4})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    const r = 1 + Math.random() * 3;
    ctx.fillStyle = `rgba(${160 + Math.random() * 40 | 0},${110 + Math.random() * 30 | 0},${60 + Math.random() * 20 | 0},${0.3 + Math.random() * 0.3})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // Мелкие камешки.
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    ctx.fillStyle = '#9a9a96';
    ctx.beginPath(); ctx.arc(x, y, 1.5 + Math.random() * 2, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

function texPlot() {
  // Подготовленный участок под захоронение — вспаханная земля с бороздами.
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, '#7c5230');
  grad.addColorStop(1, '#5a3a1c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  // Борозды.
  for (let y = 8; y < c.height; y += 16) {
    const grd = ctx.createLinearGradient(0, y - 6, 0, y + 6);
    grd.addColorStop(0, 'rgba(255,220,180,0.18)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0.30)');
    grd.addColorStop(1, 'rgba(255,220,180,0.10)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, y - 8, c.width, 16);
  }
  // Камешки и комочки.
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    ctx.fillStyle = `rgba(${30 + Math.random() * 30 | 0},${15 + Math.random() * 15 | 0},${5},${0.6})`;
    ctx.beginPath(); ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

function texStone() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  // Основной серый камень с лёгким уклоном к синеве.
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, '#d4d0c5');
  grad.addColorStop(1, '#9c9a92');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);

  // Большие плоские пятна (объём).
  for (let i = 0; i < 12; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    const r = 30 + Math.random() * 60;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.18)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    const r = 20 + Math.random() * 50;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(0,0,0,0.25)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // Кракелюр — ломаные линии.
  ctx.strokeStyle = 'rgba(50,45,38,0.55)'; ctx.lineWidth = 1.2;
  for (let i = 0; i < 22; i++) {
    ctx.beginPath();
    let x = Math.random() * c.width, y = Math.random() * c.height;
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += (Math.random() - 0.5) * 50;
      y += (Math.random() - 0.5) * 50;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Мелкие точки-вкрапления.
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    ctx.fillStyle = `rgba(${50 + Math.random() * 50 | 0},${50 + Math.random() * 50 | 0},${50 + Math.random() * 50 | 0},${0.3 + Math.random() * 0.3})`;
    ctx.beginPath(); ctx.arc(x, y, 0.6 + Math.random() * 1.2, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

function texMarble() {
  const c = makeCanvas(512);
  const ctx = c.getContext('2d');
  // Базовый кремово-белый.
  const grad = ctx.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, '#f6f3ec');
  grad.addColorStop(1, '#dad5c8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);

  // Вены — длинные плавные линии в нескольких слоях.
  function drawVeins(color, count, lineWidth, length) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      ctx.beginPath();
      let x = Math.random() * c.width, y = Math.random() * c.height;
      ctx.moveTo(x, y);
      let dir = Math.random() * Math.PI * 2;
      for (let j = 0; j < length; j++) {
        dir += (Math.random() - 0.5) * 0.6;
        x += Math.cos(dir) * 14;
        y += Math.sin(dir) * 14;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  drawVeins('rgba(120,115,128,0.55)', 14, 1.5, 25);
  drawVeins('rgba(180,170,180,0.35)', 20, 0.8, 20);
  drawVeins('rgba(70,65,80,0.45)', 4, 2.0, 30);

  // Лёгкие облака (мрамор).
  for (let i = 0; i < 26; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    const r = 30 + Math.random() * 80;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.20)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

function texWood() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  // База — тёплое дерево.
  const grad = ctx.createLinearGradient(0, 0, c.width, 0);
  grad.addColorStop(0, '#9a5e2f');
  grad.addColorStop(0.5, '#b67a44');
  grad.addColorStop(1, '#8a4f24');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);

  // Волокна — горизонтальные линии с волнами.
  for (let y = 2; y < c.height; y += 4 + Math.random() * 4) {
    ctx.strokeStyle = `rgba(${50 + Math.random() * 30 | 0},${25 + Math.random() * 20 | 0},${10 + Math.random() * 10 | 0},${0.45 + Math.random() * 0.3})`;
    ctx.lineWidth = 0.8 + Math.random() * 0.8;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= c.width; x += 6) {
      ctx.lineTo(x, y + Math.sin(x * 0.04 + y * 0.7) * 2 + (Math.random() - 0.5) * 0.8);
    }
    ctx.stroke();
  }

  // Сучок.
  for (let k = 0; k < 2; k++) {
    const cx = Math.random() * c.width, cy = Math.random() * c.height;
    for (let r = 12; r > 0; r -= 2) {
      ctx.strokeStyle = `rgba(70,40,15,${0.07 + (12 - r) / 14 * 0.3})`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = '#3a2008';
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

function texLeaves() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, '#5ea84e');
  grad.addColorStop(1, '#326c2c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);

  // Множество «листочков» овальной формы.
  for (let i = 0; i < 700; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    const r = 2 + Math.random() * 5;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.random() * Math.PI);
    const tone = 60 + Math.random() * 90;
    ctx.fillStyle = `rgb(${tone * 0.4 | 0},${tone | 0},${tone * 0.5 | 0})`;
    ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Светлые блики.
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    ctx.fillStyle = `rgba(180,230,140,${0.2 + Math.random() * 0.3})`;
    ctx.beginPath(); ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

function texPath() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  // Базовый светло-кремовый.
  ctx.fillStyle = '#cdb88f';
  ctx.fillRect(0, 0, c.width, c.height);

  // Плитка 4×4.
  const tw = c.width / 4, th = c.height / 4;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = i * tw, y = j * th;
    const tone = 200 + Math.random() * 30 - 20;
    ctx.fillStyle = `rgb(${tone * 0.85 | 0},${tone * 0.78 | 0},${tone * 0.6 | 0})`;
    ctx.fillRect(x + 1, y + 1, tw - 2, th - 2);
    // швы
    ctx.strokeStyle = 'rgba(60,40,25,0.55)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 1, y + 1, tw - 2, th - 2);
    // подсветка верхнего/левого края
    ctx.strokeStyle = 'rgba(255,240,210,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 1, y + th - 1); ctx.lineTo(x + 1, y + 1); ctx.lineTo(x + tw - 1, y + 1);
    ctx.stroke();
    // случайные крапинки
    for (let n = 0; n < 6; n++) {
      const px = x + Math.random() * tw, py = y + Math.random() * th;
      ctx.fillStyle = `rgba(80,60,40,${0.2 + Math.random() * 0.3})`;
      ctx.beginPath(); ctx.arc(px, py, 0.6 + Math.random() * 1.2, 0, Math.PI * 2); ctx.fill();
    }
  }
  return c;
}

function texGold() {
  const c = makeCanvas(128);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, '#ffe27a');
  grad.addColorStop(0.5, '#e6b240');
  grad.addColorStop(1, '#a87a18');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    ctx.fillStyle = `rgba(255,255,200,${0.2 + Math.random() * 0.5})`;
    ctx.beginPath(); ctx.arc(x, y, 0.6 + Math.random() * 1.4, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

function texIron() {
  const c = makeCanvas(128);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, '#5a5d63');
  grad.addColorStop(1, '#2c2e33');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    ctx.fillStyle = `rgba(${80 + Math.random() * 60 | 0},${80 + Math.random() * 60 | 0},${90 + Math.random() * 60 | 0},${0.2 + Math.random() * 0.4})`;
    ctx.beginPath(); ctx.arc(x, y, 0.5 + Math.random() * 1.4, 0, Math.PI * 2); ctx.fill();
  }
  // Лёгкие потёки/ржавчина.
  for (let i = 0; i < 14; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    ctx.fillStyle = `rgba(150,90,40,${0.15 + Math.random() * 0.25})`;
    ctx.fillRect(x, y, 1.5, 6 + Math.random() * 8);
  }
  return c;
}

function texFlower(petalColor, centerColor = '#ffd24a') {
  const c = makeCanvas(64);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  // Лепестки.
  ctx.fillStyle = petalColor;
  const cx = c.width / 2, cy = c.height / 2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.beginPath(); ctx.ellipse(0, -10, 7, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Серединка.
  ctx.fillStyle = centerColor;
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();
  return c;
}

// ---------- публичный API ----------

const NAMES = {
  grass: texGrass,
  dirt: texDirt,
  plot: texPlot,
  stone: texStone,
  marble: texMarble,
  wood: texWood,
  leaves: texLeaves,
  path: texPath,
  gold: texGold,
  iron: texIron,
};

export function getTexture(name) {
  if (cache.has(name)) return cache.get(name);
  const fn = NAMES[name];
  if (!fn) return null;
  const tex = toTexture(fn());
  cache.set(name, tex);
  return tex;
}

export function getGroundTexture(repeat = 50) {
  const t = getTexture('grass').clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

export function getPlotTexture(repeat = 4) {
  const t = getTexture('plot').clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}
