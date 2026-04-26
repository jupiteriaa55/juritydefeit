// Procedurally generated 16x16 pixel-art textures, packed into a single atlas.
// We use a deterministic seeded RNG so textures are stable between sessions.
// The atlas layout is one tile per (block, face) combination. Blocks may share
// the same tile across faces. Returned object exposes `texture` (a THREE.DataTexture)
// and `uv(blockId, face)` -> [u0, v0, u1, v1] for mesh generation.

import * as THREE from 'three';
import * as B from './blocks.js';

const TILE = 16;            // texture pixel size
const COLS = 8;              // tiles per row in atlas
const ROWS = 8;              // tiles per col in atlas (expanded)
const ATLAS_W = COLS * TILE;
const ATLAS_H = ROWS * TILE;

// xorshift32
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return (s >>> 0) / 0xffffffff;
  };
}

function hex(c) {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

function lerp(a, b, t) { return a + (b - a) * t; }

function shadeColor(c, amt) {
  const [r, g, b] = hex(c);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return [f(r), f(g), f(b)];
}

function mixColors(c1, c2, t) {
  const a = hex(c1), b = hex(c2);
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t))
  ];
}

class Tile {
  constructor() {
    this.data = new Uint8Array(TILE * TILE * 4);
    for (let i = 3; i < this.data.length; i += 4) this.data[i] = 255;
  }
  set(x, y, [r, g, b], a = 255) {
    if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
    const i = (y * TILE + x) * 4;
    this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = a;
  }
  get(x, y) {
    const i = (y * TILE + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }
  fill(rgb) {
    for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) this.set(x, y, rgb);
  }
  noise(rng, base, intensity = 0.12) {
    const baseHex = (typeof base === 'number') ? base : rgbToHex(base);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const n = (rng() - 0.5) * 2 * intensity;
        this.set(x, y, shadeColor(baseHex, n));
      }
    }
  }
}

function rgbToHex([r, g, b]) {
  return ((r & 255) << 16) | ((g & 255) << 8) | (b & 255);
}

// --- per-block tile generators ---

function tGrassTop(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0x4f9a2a;
  const acc = 0x6dbf3a;
  const dark = 0x356b1d;
  t.noise(r, base, 0.10);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const v = r();
    if (v > 0.92) t.set(x, y, hex(acc));
    else if (v < 0.06) t.set(x, y, hex(dark));
  }
  return t;
}

function tGrassSide(seed) {
  const t = new Tile();
  const r = rng(seed);
  const dirt = 0x7a5a36;
  const grass = 0x4f9a2a;
  const grassLight = 0x6dbf3a;
  // dirt body
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const n = (r() - 0.5) * 0.16;
    t.set(x, y, shadeColor(dirt, n));
  }
  // grass top strip 4px with jagged bottom
  for (let x = 0; x < TILE; x++) {
    const h = 3 + Math.floor(r() * 2);
    for (let y = 0; y < h; y++) {
      const c = r() > 0.5 ? grass : grassLight;
      t.set(x, y, hex(c));
    }
    if (r() > 0.6) t.set(x, h, hex(grass));
  }
  return t;
}

function tDirt(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0x8b5a2b;
  const dark = 0x6b4421;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const n = (r() - 0.5) * 0.18;
    t.set(x, y, shadeColor(base, n));
    if (r() > 0.94) t.set(x, y, hex(dark));
  }
  return t;
}

function tStone(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0x8a8a8a;
  const dark = 0x6c6c6c;
  const light = 0xa3a3a3;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const n = (r() - 0.5) * 0.10;
    t.set(x, y, shadeColor(base, n));
  }
  // craggy spots
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(r() * TILE), y = Math.floor(r() * TILE);
    const c = r() > 0.5 ? dark : light;
    t.set(x, y, hex(c));
    if (r() > 0.5) t.set(x + 1, y, hex(c));
    if (r() > 0.5) t.set(x, y + 1, hex(c));
  }
  return t;
}

function tCobble(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0x7a7a7a;
  t.noise(r, base, 0.06);
  // grout grid
  for (let i = 0; i < TILE; i++) {
    if (r() > 0.4) t.set(i, 7, hex(0x4d4d4d));
    if (r() > 0.4) t.set(7, i, hex(0x4d4d4d));
    if (r() > 0.4) t.set(i, 15, hex(0x4d4d4d));
    if (r() > 0.4) t.set(15, i, hex(0x4d4d4d));
  }
  // little chunks
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(r() * TILE), y = Math.floor(r() * TILE);
    t.set(x, y, hex(0x9c9c9c));
  }
  return t;
}

function tWoodTop(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0xb38a4f;
  const dark = 0x6b4a25;
  t.noise(r, base, 0.08);
  // rings
  const cx = 7, cy = 7;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    if (Math.abs(d % 3 - 0.3) < 0.6) t.set(x, y, hex(dark));
  }
  return t;
}

function tWoodSide(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0x8a6135;
  const dark = 0x5a3d20;
  const light = 0xa57441;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const n = (r() - 0.5) * 0.12;
    t.set(x, y, shadeColor(base, n));
  }
  for (let x = 0; x < TILE; x++) {
    if (r() > 0.7) {
      for (let y = 0; y < TILE; y++) t.set(x, y, hex(dark));
    } else if (r() > 0.6) {
      for (let y = 0; y < TILE; y++) t.set(x, y, hex(light));
    }
  }
  return t;
}

function tLeaves(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0x3d8a25;
  const dark = 0x265919;
  const light = 0x59b034;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const v = r();
    if (v > 0.7) t.set(x, y, hex(light));
    else if (v < 0.25) t.set(x, y, hex(dark));
    else t.set(x, y, hex(base));
  }
  // some "holes" - darker pixels for transparency feel
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(r() * TILE), y = Math.floor(r() * TILE);
    t.set(x, y, hex(0x1a3a10));
  }
  return t;
}

function tSand(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0xe2cf86;
  t.noise(r, base, 0.06);
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(r() * TILE), y = Math.floor(r() * TILE);
    t.set(x, y, hex(0xc7b466));
  }
  return t;
}

function tWater(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0x2a6dd6;
  t.noise(r, base, 0.06);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    if ((x + y) % 4 === 0 && r() > 0.5) t.set(x, y, hex(0x4f9bff));
  }
  return t;
}

function tPlank(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0xb3823f;
  const dark = 0x7a5520;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const n = (r() - 0.5) * 0.08;
    t.set(x, y, shadeColor(base, n));
  }
  // horizontal planks
  for (let y of [3, 7, 11, 15]) {
    for (let x = 0; x < TILE; x++) t.set(x, y, hex(dark));
  }
  // nail/knot dots
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(r() * TILE);
    const y = [1, 5, 9, 13][Math.floor(r() * 4)];
    t.set(x, y, hex(0x5a3a14));
  }
  return t;
}

function tBrick(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0xa8493b;
  const dark = 0x5a2218;
  const light = 0xc0594a;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const n = (r() - 0.5) * 0.10;
    t.set(x, y, shadeColor(base, n));
  }
  // mortar lines: rows at y=3,7,11,15 fully; staggered vertical seams
  for (let y of [3, 7, 11, 15]) for (let x = 0; x < TILE; x++) t.set(x, y, hex(dark));
  for (let x of [0, 8]) for (let y = 4; y < 7; y++) t.set(x, y, hex(dark));
  for (let x of [4, 12]) for (let y = 0; y < 3; y++) t.set(x, y, hex(dark));
  for (let x of [0, 8]) for (let y = 12; y < 15; y++) t.set(x, y, hex(dark));
  for (let x of [4, 12]) for (let y = 8; y < 11; y++) t.set(x, y, hex(dark));
  // highlights
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(r() * TILE), y = Math.floor(r() * TILE);
    t.set(x, y, hex(light));
  }
  return t;
}

function tGlass() {
  const t = new Tile();
  const tint = hex(0xc7e7ff);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) t.set(x, y, tint, 90);
  // frame
  for (let i = 0; i < TILE; i++) {
    t.set(i, 0, hex(0xffffff), 200);
    t.set(i, TILE - 1, hex(0xffffff), 200);
    t.set(0, i, hex(0xffffff), 200);
    t.set(TILE - 1, i, hex(0xffffff), 200);
  }
  // diagonal sheen
  for (let i = 2; i < TILE - 2; i++) t.set(i, i, hex(0xffffff), 140);
  return t;
}

function tLampOff(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0x6b5018;
  t.noise(r, base, 0.10);
  // grid of darker dots
  for (let y = 1; y < TILE; y += 3) for (let x = 1; x < TILE; x += 3) {
    t.set(x, y, hex(0x3d2c0a));
  }
  return t;
}

function tLampOn(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0xfff0a0;
  t.noise(r, base, 0.05);
  for (let y = 1; y < TILE; y += 3) for (let x = 1; x < TILE; x += 3) {
    t.set(x, y, hex(0xffd35a));
    t.set(x + 1, y, hex(0xffeea0));
    t.set(x, y + 1, hex(0xffeea0));
  }
  return t;
}

function tWire() {
  const t = new Tile();
  const base = hex(0x3a2020);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) t.set(x, y, base);
  for (let x = 0; x < TILE; x++) {
    t.set(x, 6, hex(0xc02a2a));
    t.set(x, 7, hex(0xff5050));
    t.set(x, 8, hex(0xc02a2a));
  }
  for (let y = 0; y < TILE; y++) {
    t.set(6, y, hex(0xc02a2a));
    t.set(7, y, hex(0xff5050));
    t.set(8, y, hex(0xc02a2a));
  }
  return t;
}

function tButton() {
  const t = new Tile();
  const base = hex(0x6e3a20);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) t.set(x, y, base);
  for (let y = 5; y < 11; y++) for (let x = 4; x < 12; x++) t.set(x, y, hex(0xe65a2e));
  for (let x = 4; x < 12; x++) { t.set(x, 5, hex(0xff8a55)); t.set(x, 10, hex(0xa83a18)); }
  for (let y = 5; y < 11; y++) { t.set(4, y, hex(0xff8a55)); t.set(11, y, hex(0xa83a18)); }
  return t;
}

function tRoof(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0x6e2a23;
  const dark = 0x42150f;
  const light = 0x9a3f33;
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) {
    const n = (r() - 0.5) * 0.10;
    t.set(x, y, shadeColor(base, n));
  }
  // shingle pattern
  for (let y = 0; y < TILE; y += 4) {
    for (let x = 0; x < TILE; x++) t.set(x, y, hex(dark));
  }
  for (let y = 1; y < TILE; y += 4) {
    for (let x = 0; x < TILE; x += 8) t.set(x, y, hex(light));
  }
  for (let y = 1; y < TILE; y += 4) {
    for (let x = 4; x < TILE; x += 8) t.set(x, y + 2, hex(light));
  }
  return t;
}

function tPath(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0x9b8761;
  t.noise(r, base, 0.10);
  for (let i = 0; i < 16; i++) {
    const x = Math.floor(r() * TILE), y = Math.floor(r() * TILE);
    t.set(x, y, hex(0x6f5a3a));
  }
  return t;
}

function tOre(seed, oreColor, base = 0x8a8a8a) {
  const t = tStone(seed);
  const r = rng(seed ^ 0x5a5a);
  // sprinkle ore clusters
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(r() * (TILE - 2));
    const y = Math.floor(r() * (TILE - 2));
    const shape = [[0,0],[1,0],[0,1],[1,1]];
    for (const [dx, dy] of shape) {
      if (r() > 0.3) t.set(x + dx, y + dy, hex(oreColor));
    }
  }
  return t;
}

function tSnow(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0xeef4ff;
  t.noise(r, base, 0.04);
  for (let i = 0; i < 12; i++) {
    const x = Math.floor(r() * TILE), y = Math.floor(r() * TILE);
    t.set(x, y, hex(0xffffff));
  }
  return t;
}

function tIce(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0x9fcaff;
  t.noise(r, base, 0.06);
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(r() * TILE), y = Math.floor(r() * TILE);
    t.set(x, y, hex(0xd8eaff));
  }
  // crack lines
  for (let i = 0; i < 3; i++) {
    let x = Math.floor(r() * TILE), y = Math.floor(r() * TILE);
    for (let s = 0; s < 6; s++) {
      t.set(x, y, hex(0x6da6e8));
      x += r() > 0.5 ? 1 : 0; y += r() > 0.5 ? 1 : 0;
    }
  }
  return t;
}

function tGravel(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0x808078;
  t.noise(r, base, 0.10);
  for (let i = 0; i < 24; i++) {
    const x = Math.floor(r() * TILE), y = Math.floor(r() * TILE);
    const c = r() > 0.5 ? 0x9c9c94 : 0x5a5a52;
    t.set(x, y, hex(c));
  }
  return t;
}

function tBedrock(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0x303030;
  t.noise(r, base, 0.16);
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(r() * TILE), y = Math.floor(r() * TILE);
    const c = r() > 0.5 ? 0x101010 : 0x484848;
    t.set(x, y, hex(c));
  }
  return t;
}

function tObsidian(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0x1a1230;
  t.noise(r, base, 0.10);
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(r() * TILE), y = Math.floor(r() * TILE);
    t.set(x, y, hex(0x6a4ab8));
  }
  return t;
}

function tCactusTop(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0x3d8a2a;
  t.noise(r, base, 0.06);
  // ridges
  for (let y of [3, 7, 11]) for (let x = 0; x < TILE; x++) t.set(x, y, hex(0x265919));
  // spines
  for (let i = 0; i < 8; i++) {
    const x = Math.floor(r() * TILE), y = Math.floor(r() * TILE);
    t.set(x, y, hex(0xc7e7a8));
  }
  return t;
}

function tCactusSide(seed) {
  const t = new Tile();
  const r = rng(seed);
  const base = 0x4f9a2a;
  t.noise(r, base, 0.05);
  // vertical ridges
  for (let x of [2, 7, 13]) for (let y = 0; y < TILE; y++) t.set(x, y, hex(0x265919));
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(r() * TILE), y = Math.floor(r() * TILE);
    if (r() > 0.5) t.set(x, y, hex(0xc7e7a8));
  }
  return t;
}

function tFlower(seed, petalColor) {
  const t = new Tile();
  // mostly transparent
  for (let i = 3; i < t.data.length; i += 4) t.data[i] = 0;
  // stem
  const stemX = 7;
  for (let y = 7; y < 14; y++) t.set(stemX, y, hex(0x2a6b1a));
  for (let y = 9; y < 13; y++) t.set(stemX + 1, y, hex(0x265919));
  // leaf
  t.set(stemX - 1, 11, hex(0x4f9a2a));
  t.set(stemX + 2, 12, hex(0x4f9a2a));
  // petals (3x3 cluster around top)
  const cx = 7, cy = 5;
  const petalShape = [[cx-1,cy-1],[cx,cy-1],[cx+1,cy-1],[cx-1,cy],[cx+1,cy],[cx-1,cy+1],[cx,cy+1],[cx+1,cy+1]];
  for (const [px, py] of petalShape) t.set(px, py, hex(petalColor));
  // center
  t.set(cx, cy, hex(0xffd84a));
  return t;
}

function tTallGrass(seed) {
  const t = new Tile();
  for (let i = 3; i < t.data.length; i += 4) t.data[i] = 0;
  const r = rng(seed);
  const c1 = 0x4f9a2a, c2 = 0x6dbf3a, c3 = 0x356b1d;
  for (let x = 0; x < TILE; x++) {
    if (r() > 0.6) {
      const top = 4 + Math.floor(r() * 4);
      for (let y = top; y < TILE; y++) {
        const c = r() > 0.5 ? c1 : (r() > 0.4 ? c2 : c3);
        t.set(x, y, hex(c));
      }
    }
  }
  return t;
}

function tTorch() {
  const t = new Tile();
  for (let i = 3; i < t.data.length; i += 4) t.data[i] = 0;
  // stick
  for (let y = 7; y < 16; y++) {
    t.set(7, y, hex(0x6b4a25));
    t.set(8, y, hex(0x8a6135));
  }
  // flame top
  const flame = [
    [7,3,0xfff0a0],[8,3,0xfff0a0],
    [6,4,0xffd35a],[7,4,0xffeea0],[8,4,0xffeea0],[9,4,0xffd35a],
    [6,5,0xff9a2a],[7,5,0xffd35a],[8,5,0xffd35a],[9,5,0xff9a2a],
    [7,6,0xff9a2a],[8,6,0xff9a2a]
  ];
  for (const [x, y, c] of flame) t.set(x, y, hex(c));
  return t;
}

// Atlas slot map: blockId -> { top, side, bottom } each is index in atlas (col,row)
const SLOTS = {};
let nextSlot = 0;
function slot() { const s = nextSlot++; return [s % COLS, Math.floor(s / COLS)]; }

const tiles = []; // index = slot order
function add(tile) { tiles.push(tile); return slot(); }

const sGrassTop = add(tGrassTop(101));
const sGrassSide = add(tGrassSide(102));
const sDirt = add(tDirt(103));
const sStone = add(tStone(104));
const sCobble = add(tCobble(105));
const sWoodTop = add(tWoodTop(106));
const sWoodSide = add(tWoodSide(107));
const sLeaves = add(tLeaves(108));
const sSand = add(tSand(109));
const sWater = add(tWater(110));
const sPlank = add(tPlank(111));
const sBrick = add(tBrick(112));
const sGlass = add(tGlass());
const sLampOff = add(tLampOff(113));
const sLampOn = add(tLampOn(114));
const sWire = add(tWire());
const sButton = add(tButton());
const sRoof = add(tRoof(115));
const sPath = add(tPath(116));
const sCoal    = add(tOre(120, 0x222222));
const sIron    = add(tOre(121, 0xd6a981));
const sGold    = add(tOre(122, 0xffd84a));
const sDiamond = add(tOre(123, 0x6ee7ff));
const sSnow    = add(tSnow(124));
const sIce     = add(tIce(125));
const sGravel  = add(tGravel(126));
const sBedrock = add(tBedrock(127));
const sObs     = add(tObsidian(128));
const sCactusTop = add(tCactusTop(129));
const sCactusSide = add(tCactusSide(130));
const sFlowerR = add(tFlower(131, 0xd6322a));
const sFlowerY = add(tFlower(132, 0xffd84a));
const sTallGrass = add(tTallGrass(133));
const sTorch   = add(tTorch());
const sSnowGrassSide = add((function() {
  const t = tGrassSide(134);
  // top half snow
  for (let x = 0; x < 16; x++) for (let y = 0; y < 5; y++) {
    const v = (Math.random() * 0.1 - 0.05);
    t.set(x, y, [255, 255, 255]);
  }
  return t;
})());

SLOTS[B.GRASS]    = { top: sGrassTop, side: sGrassSide, bottom: sDirt };
SLOTS[B.DIRT]     = { top: sDirt, side: sDirt, bottom: sDirt };
SLOTS[B.STONE]    = { top: sStone, side: sStone, bottom: sStone };
SLOTS[B.COBBLE]   = { top: sCobble, side: sCobble, bottom: sCobble };
SLOTS[B.WOOD]     = { top: sWoodTop, side: sWoodSide, bottom: sWoodTop };
SLOTS[B.LEAVES]   = { top: sLeaves, side: sLeaves, bottom: sLeaves };
SLOTS[B.SAND]     = { top: sSand, side: sSand, bottom: sSand };
SLOTS[B.WATER]    = { top: sWater, side: sWater, bottom: sWater };
SLOTS[B.PLANK]    = { top: sPlank, side: sPlank, bottom: sPlank };
SLOTS[B.BRICK]    = { top: sBrick, side: sBrick, bottom: sBrick };
SLOTS[B.GLASS]    = { top: sGlass, side: sGlass, bottom: sGlass };
SLOTS[B.LAMP_OFF] = { top: sLampOff, side: sLampOff, bottom: sLampOff };
SLOTS[B.LAMP_ON]  = { top: sLampOn, side: sLampOn, bottom: sLampOn };
SLOTS[B.WIRE]     = { top: sWire, side: sWire, bottom: sWire };
SLOTS[B.BUTTON]   = { top: sButton, side: sButton, bottom: sButton };
SLOTS[B.ROOF]     = { top: sRoof, side: sRoof, bottom: sRoof };
SLOTS[B.PATH]     = { top: sPath, side: sPath, bottom: sPath };
SLOTS[B.COAL_ORE]    = { top: sCoal, side: sCoal, bottom: sCoal };
SLOTS[B.IRON_ORE]    = { top: sIron, side: sIron, bottom: sIron };
SLOTS[B.GOLD_ORE]    = { top: sGold, side: sGold, bottom: sGold };
SLOTS[B.DIAMOND_ORE] = { top: sDiamond, side: sDiamond, bottom: sDiamond };
SLOTS[B.SNOW]        = { top: sSnow, side: sSnow, bottom: sSnow };
SLOTS[B.ICE]         = { top: sIce, side: sIce, bottom: sIce };
SLOTS[B.GRAVEL]      = { top: sGravel, side: sGravel, bottom: sGravel };
SLOTS[B.BEDROCK]     = { top: sBedrock, side: sBedrock, bottom: sBedrock };
SLOTS[B.OBSIDIAN]    = { top: sObs, side: sObs, bottom: sObs };
SLOTS[B.CACTUS]      = { top: sCactusTop, side: sCactusSide, bottom: sCactusTop };
SLOTS[B.FLOWER_RED]  = { top: sFlowerR, side: sFlowerR, bottom: sFlowerR };
SLOTS[B.FLOWER_YELLOW] = { top: sFlowerY, side: sFlowerY, bottom: sFlowerY };
SLOTS[B.TALL_GRASS]  = { top: sTallGrass, side: sTallGrass, bottom: sTallGrass };
SLOTS[B.TORCH]       = { top: sTorch, side: sTorch, bottom: sTorch };
SLOTS[B.SNOW_GRASS]  = { top: sSnow, side: sSnowGrassSide, bottom: sDirt };

// Compose atlas DataTexture
const atlas = new Uint8Array(ATLAS_W * ATLAS_H * 4);
for (let i = 3; i < atlas.length; i += 4) atlas[i] = 255;

for (let i = 0; i < tiles.length; i++) {
  const cx = i % COLS, cy = Math.floor(i / COLS);
  const t = tiles[i];
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      const dst = ((cy * TILE + y) * ATLAS_W + (cx * TILE + x)) * 4;
      const src = (y * TILE + x) * 4;
      atlas[dst] = t.data[src];
      atlas[dst + 1] = t.data[src + 1];
      atlas[dst + 2] = t.data[src + 2];
      atlas[dst + 3] = t.data[src + 3];
    }
  }
}

export const atlasTexture = new THREE.DataTexture(atlas, ATLAS_W, ATLAS_H, THREE.RGBAFormat);
atlasTexture.magFilter = THREE.NearestFilter;
atlasTexture.minFilter = THREE.NearestMipMapNearestFilter;
atlasTexture.generateMipmaps = true;
atlasTexture.wrapS = THREE.ClampToEdgeWrapping;
atlasTexture.wrapT = THREE.ClampToEdgeWrapping;
atlasTexture.colorSpace = THREE.SRGBColorSpace;
atlasTexture.needsUpdate = true;

export function uvFor(blockId, face) {
  const slot = SLOTS[blockId];
  if (!slot) return uvFor(B.STONE, face);
  const [cx, cy] = slot[face] || slot.side;
  const u0 = (cx * TILE) / ATLAS_W;
  const v0 = 1 - ((cy + 1) * TILE) / ATLAS_H;
  const u1 = ((cx + 1) * TILE) / ATLAS_W;
  const v1 = 1 - (cy * TILE) / ATLAS_H;
  // shrink slightly to avoid bleeding (half-pixel inset)
  const px = 0.5 / ATLAS_W;
  const py = 0.5 / ATLAS_H;
  return [u0 + px, v0 + py, u1 - px, v1 - py];
}

// Returns a small CSS swatch color for hotbar UI (uses the side tile center pixel).
export function swatchColor(blockId) {
  const slot = SLOTS[blockId];
  if (!slot) return '#888';
  const [cx, cy] = slot.side || slot.top;
  const x = cx * TILE + 8, y = cy * TILE + 8;
  const i = (y * ATLAS_W + x) * 4;
  const r = atlas[i], g = atlas[i + 1], b = atlas[i + 2];
  return `rgb(${r},${g},${b})`;
}

export const ATLAS = { width: ATLAS_W, height: ATLAS_H, tile: TILE, cols: COLS, rows: ROWS };
