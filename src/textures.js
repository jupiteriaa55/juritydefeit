// Процедурные мультяшные текстуры. Генерируются через Canvas2D на лету —
// не нужно качать ассеты, всё работает офлайн в PWA и в Android-сборке.
// Стиль: насыщенные «плоские» цвета + лёгкий шум и контурные детали.

import * as THREE from 'three';

const cache = new Map();

function makeCanvas(size = 128) {
  const c = (typeof OffscreenCanvas !== 'undefined')
    ? new OffscreenCanvas(size, size)
    : Object.assign(document.createElement('canvas'), { width: size, height: size });
  return c;
}

function fillRand(ctx, color, count, sizeMin, sizeMax, opts = {}) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = Math.random() * ctx.canvas.width;
    const y = Math.random() * ctx.canvas.height;
    const r = sizeMin + Math.random() * (sizeMax - sizeMin);
    if (opts.shape === 'rect') {
      ctx.fillRect(x, y, r, r * (0.6 + Math.random() * 0.6));
    } else if (opts.shape === 'streak') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.random() * Math.PI);
      ctx.fillRect(-r, -1, r * 2, 2);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function toTexture(canvas, opts = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = opts.repeat !== false ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// ---------- генераторы ----------

function texGrass() {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, '#7bbb6a');
  grad.addColorStop(1, '#5e9a4f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  fillRand(ctx, 'rgba(40,90,40,0.45)', 220, 1.5, 3);
  fillRand(ctx, 'rgba(180,220,140,0.55)', 180, 1, 2.2);
  // редкие травинки штрихами
  ctx.strokeStyle = 'rgba(30,70,30,0.6)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 4, y + 4 + Math.random() * 4);
    ctx.stroke();
  }
  // редкие цветочки
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * c.width, y = Math.random() * c.height;
    ctx.fillStyle = ['#ffd24a', '#ffffff', '#ff7a7a', '#c388ff'][i % 4];
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
  }
  return c;
}

function texDirt() {
  const c = makeCanvas(128);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, '#7a4f2a');
  grad.addColorStop(1, '#5a3618');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  fillRand(ctx, 'rgba(40,20,10,0.5)', 80, 1.5, 4);
  fillRand(ctx, 'rgba(160,110,60,0.4)', 60, 1, 2);
  fillRand(ctx, '#2a1a0c', 30, 1, 2);
  return c;
}

function texStone() {
  const c = makeCanvas(128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#bfbcb1';
  ctx.fillRect(0, 0, c.width, c.height);
  fillRand(ctx, 'rgba(120,118,108,0.55)', 60, 2, 6);
  fillRand(ctx, 'rgba(230,228,218,0.5)', 50, 1, 4);
  // кракелюр
  ctx.strokeStyle = 'rgba(60,55,45,0.55)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    let x = Math.random() * c.width, y = Math.random() * c.height;
    ctx.moveTo(x, y);
    for (let j = 0; j < 3; j++) {
      x += (Math.random() - 0.5) * 30;
      y += (Math.random() - 0.5) * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return c;
}

function texMarble() {
  const c = makeCanvas(128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#efeeea';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(140,140,150,0.55)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 18; i++) {
    ctx.beginPath();
    let x = Math.random() * c.width, y = Math.random() * c.height;
    ctx.moveTo(x, y);
    for (let j = 0; j < 8; j++) {
      x += (Math.random() - 0.5) * 22;
      y += (Math.random() - 0.5) * 22;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  fillRand(ctx, 'rgba(210,205,200,0.4)', 30, 2, 5);
  return c;
}

function texWood() {
  const c = makeCanvas(128);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, c.width, 0);
  grad.addColorStop(0, '#a06636');
  grad.addColorStop(0.5, '#b87a44');
  grad.addColorStop(1, '#945a30');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(80,40,20,0.5)';
  ctx.lineWidth = 1.4;
  for (let y = 4; y < c.height; y += 6 + Math.random() * 4) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= c.width; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.05 + y) * 1.6);
    ctx.stroke();
  }
  return c;
}

function texLeaves() {
  const c = makeCanvas(128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3f7a37';
  ctx.fillRect(0, 0, c.width, c.height);
  fillRand(ctx, '#4f9c41', 120, 3, 7);
  fillRand(ctx, '#6abb55', 90, 2, 4);
  fillRand(ctx, '#2a5523', 60, 2, 4);
  return c;
}

function texPath() {
  const c = makeCanvas(128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c8b89a';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(80,60,40,0.55)';
  ctx.lineWidth = 2;
  // Имитация плитки
  ctx.strokeRect(2, 2, c.width - 4, c.height - 4);
  ctx.beginPath();
  ctx.moveTo(c.width / 2, 2); ctx.lineTo(c.width / 2, c.height - 2);
  ctx.moveTo(2, c.height / 2); ctx.lineTo(c.width - 2, c.height / 2);
  ctx.stroke();
  fillRand(ctx, 'rgba(160,140,110,0.6)', 40, 1, 3);
  fillRand(ctx, 'rgba(90,70,50,0.5)', 30, 1, 2);
  return c;
}

// ---------- публичный API ----------

export function getTexture(name) {
  if (cache.has(name)) return cache.get(name);
  let canvas;
  switch (name) {
    case 'grass': canvas = texGrass(); break;
    case 'dirt': canvas = texDirt(); break;
    case 'stone': canvas = texStone(); break;
    case 'marble': canvas = texMarble(); break;
    case 'wood': canvas = texWood(); break;
    case 'leaves': canvas = texLeaves(); break;
    case 'path': canvas = texPath(); break;
    default: return null;
  }
  const tex = toTexture(canvas);
  cache.set(name, tex);
  return tex;
}

// Возвращает текстуру травы с настраиваемым repeat.
export function getGroundTexture(repeat = 50) {
  const t = getTexture('grass').clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}
