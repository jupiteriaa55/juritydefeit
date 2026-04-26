// Generate PNG icons for PWA / Android / iOS using node:canvas-free approach.
// We just write a tiny PNG procedurally so we don't need extra deps.
// 192/512 maskable icons with VoxelCraft logo.

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(__dirname, '..', 'public', 'icons');
mkdirSync(out, { recursive: true });

// Tiny PNG encoder (no compression — uses uncompressed deflate blocks).
function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}
function adler32(buf) {
  let a = 1, b = 0;
  for (let i = 0; i < buf.length; i++) { a = (a + buf[i]) % 65521; b = (b + a) % 65521; }
  return ((b << 16) | a) >>> 0;
}
function u32(n) { return Buffer.from([(n>>>24)&255,(n>>>16)&255,(n>>>8)&255,n&255]); }
function chunk(type, data) {
  const tBuf = Buffer.from(type, 'ascii');
  const len = u32(data.length);
  const crc = u32(crc32(Buffer.concat([tBuf, data])));
  return Buffer.concat([len, tBuf, data, crc]);
}
function makePng(width, height, getRgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.concat([u32(width), u32(height), Buffer.from([8, 6, 0, 0, 0])]); // 8-bit RGBA
  // raw scanlines
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter none
    for (let x = 0; x < width; x++) {
      const off = y * (1 + width * 4) + 1 + x * 4;
      const [r, g, b, a] = getRgba(x, y);
      raw[off] = r; raw[off + 1] = g; raw[off + 2] = b; raw[off + 3] = a;
    }
  }
  // Build zlib stream manually with stored (uncompressed) deflate
  const cmf = 0x78, flg = 0x01;
  const blocks = [];
  let pos = 0;
  while (pos < raw.length) {
    const remain = raw.length - pos;
    const len = Math.min(remain, 65535);
    const final = (pos + len === raw.length) ? 1 : 0;
    const header = Buffer.from([final, len & 0xff, (len >>> 8) & 0xff, (~len) & 0xff, ((~len) >>> 8) & 0xff]);
    blocks.push(header);
    blocks.push(raw.slice(pos, pos + len));
    pos += len;
  }
  const compressed = Buffer.concat([Buffer.from([cmf, flg]), ...blocks, u32(adler32(raw))]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

function paletteRect(x, y, w, h, color, get) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    if (xx < 0 || yy < 0) continue;
    set(xx, yy, color, 255, get);
  }
}
function set(x, y, color, alpha, target) { target.data[y * target.w * 4 + x * 4] = (color >> 16) & 255; target.data[y * target.w * 4 + x * 4 + 1] = (color >> 8) & 255; target.data[y * target.w * 4 + x * 4 + 2] = color & 255; target.data[y * target.w * 4 + x * 4 + 3] = alpha; }

function drawIcon(size, maskable = false) {
  const buf = { w: size, h: size, data: Buffer.alloc(size * size * 4) };
  // background
  const bg = maskable ? 0x0b1020 : 0x132a4a;
  for (let i = 0; i < size * size; i++) {
    buf.data[i*4] = (bg >> 16) & 255; buf.data[i*4+1] = (bg >> 8) & 255; buf.data[i*4+2] = bg & 255; buf.data[i*4+3] = 255;
  }
  // Draw a 32x32 voxel pattern scaled
  const grid = 16;
  const cell = Math.floor(size / grid);
  const margin = Math.floor((size - cell * grid) / 2);
  function px(gx, gy, color) {
    paletteRect(margin + gx * cell, margin + gy * cell, cell, cell, color, buf);
  }
  // earth: rows 7-15 dirt/stone
  for (let y = 8; y < 16; y++) for (let x = 0; x < 16; x++) {
    const c = (x + y) % 3 === 0 ? 0x6e4621 : 0x8b5a2b;
    px(x, y, c);
  }
  // grass top row
  for (let x = 0; x < 16; x++) {
    px(x, 7, (x % 2) ? 0x4f9a2a : 0x6dbf3a);
    if (x % 3 === 0) px(x, 6, 0x6dbf3a);
  }
  // a small castle on top
  for (let x = 4; x < 12; x++) px(x, 5, 0x7d7d7d);
  for (let x = 4; x < 12; x++) px(x, 4, 0x9a9a9a);
  for (let x = 4; x < 12; x += 2) px(x, 3, 0x7d7d7d);
  px(7, 5, 0x4a2818); // door
  // sun in upper right
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) px(13 + dx, dy, 0xffd84a);
  // brick chimney
  px(9, 2, 0xa8493b); px(9, 3, 0xa8493b);
  return makePng(size, size, (x, y) => [buf.data[y*size*4+x*4], buf.data[y*size*4+x*4+1], buf.data[y*size*4+x*4+2], 255]);
}

writeFileSync(join(out, 'icon-192.png'), drawIcon(192));
writeFileSync(join(out, 'icon-512.png'), drawIcon(512));
writeFileSync(join(out, 'maskable-512.png'), drawIcon(512, true));
console.log('Icons written to', out);
