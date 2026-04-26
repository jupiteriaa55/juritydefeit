// Voxel world: chunked storage + procedural terrain with multiple biomes,
// caves (3D noise), ores, flowers/grass/cacti, and trees.
//
// Coordinates: world (x,y,z) integers. y is up, range [0, WORLD_H).

import { createNoise2D, createNoise3D } from 'simplex-noise';
import * as B from './blocks.js';

export const CHUNK_SIZE = 16;
export const WORLD_H = 80;
export const SEA_LEVEL = 28;

// Biome IDs
export const BIOME_PLAINS = 0;
export const BIOME_FOREST = 1;
export const BIOME_DESERT = 2;
export const BIOME_MOUNTAIN = 3;
export const BIOME_OCEAN = 4;
export const BIOME_SNOW = 5;

function mulberry32(a) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class World {
  constructor(seed) {
    this.seed = (seed >>> 0) || (Math.floor(Math.random() * 0xffffffff) >>> 0);
    const r = mulberry32(this.seed);
    this.terrain = createNoise2D(mulberry32(this.seed));
    this.detail  = createNoise2D(mulberry32(this.seed ^ 0x12345));
    this.tempN   = createNoise2D(mulberry32(this.seed ^ 0xa1b2c));
    this.humN    = createNoise2D(mulberry32(this.seed ^ 0xdeadb));
    this.tree    = createNoise2D(mulberry32(this.seed ^ 0x1234));
    this.cave    = createNoise3D(mulberry32(this.seed ^ 0xc0ffee));
    this.ore     = createNoise3D(mulberry32(this.seed ^ 0x0a0a0a));
    this.chunks = new Map();
    this.dirty = new Set();
    this.overrides = new Map();
  }

  key(cx, cz) { return `${cx},${cz}`; }

  biomeAt(x, z) {
    const t = this.tempN(x * 0.0042, z * 0.0042); // -1..1
    const h = this.humN(x * 0.0035, z * 0.0035);
    const m = this.terrain(x * 0.012, z * 0.012);
    if (m < -0.55) return BIOME_OCEAN;
    if (t < -0.45) return BIOME_SNOW;
    if (t > 0.45 && h < -0.05) return BIOME_DESERT;
    if (m > 0.55) return BIOME_MOUNTAIN;
    if (h > 0.1) return BIOME_FOREST;
    return BIOME_PLAINS;
  }

  heightAt(x, z) {
    const biome = this.biomeAt(x, z);
    const n1 = this.terrain(x * 0.012, z * 0.012);
    const n2 = this.terrain(x * 0.05, z * 0.05) * 0.4;
    const n3 = this.detail(x * 0.18, z * 0.18) * 0.18;
    let v = (n1 + n2 + n3);
    let amp, base;
    switch (biome) {
      case BIOME_OCEAN:    base = SEA_LEVEL - 6; amp = 4; break;
      case BIOME_DESERT:   base = SEA_LEVEL + 2; amp = 4; break;
      case BIOME_MOUNTAIN: base = SEA_LEVEL + 14; amp = 18; break;
      case BIOME_SNOW:     base = SEA_LEVEL + 6; amp = 10; break;
      case BIOME_FOREST:   base = SEA_LEVEL + 4; amp = 8; break;
      default:             base = SEA_LEVEL + 3; amp = 6;
    }
    return Math.max(2, Math.min(WORLD_H - 4, Math.floor(base + v * amp)));
  }

  surfaceBlock(biome, h) {
    if (biome === BIOME_DESERT) return B.SAND;
    if (biome === BIOME_SNOW) return B.SNOW_GRASS;
    if (biome === BIOME_MOUNTAIN && h > SEA_LEVEL + 22) return B.SNOW;
    if (biome === BIOME_OCEAN) return B.SAND;
    return B.GRASS;
  }

  subBlock(biome, depthBelowSurface) {
    if (biome === BIOME_DESERT) return depthBelowSurface < 4 ? B.SAND : B.STONE;
    if (biome === BIOME_OCEAN) return depthBelowSurface < 2 ? B.SAND : B.STONE;
    return depthBelowSurface < 3 ? B.DIRT : B.STONE;
  }

  ensureChunk(cx, cz) {
    const k = this.key(cx, cz);
    let ch = this.chunks.get(k);
    if (ch) return ch;
    ch = this.generateChunk(cx, cz);
    this.chunks.set(k, ch);
    this.dirty.add(k);
    return ch;
  }

  generateChunk(cx, cz) {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_H);
    const idx = (lx, y, lz) => ((lz * CHUNK_SIZE) + lx) * WORLD_H + y;
    const treeR = mulberry32(((cx * 73856093) ^ (cz * 19349663) ^ this.seed) >>> 0);

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const biome = this.biomeAt(wx, wz);
        const h = this.heightAt(wx, wz);
        // bedrock layer at y=0
        data[idx(lx, 0, lz)] = B.BEDROCK;
        // fill column
        for (let y = 1; y <= h; y++) {
          let id;
          if (y === h) id = this.surfaceBlock(biome, h);
          else id = this.subBlock(biome, h - y);
          // ores in stone layer
          if (id === B.STONE && y < h - 2 && y < SEA_LEVEL + 4) {
            id = this.maybeOre(wx, y, wz, id);
          }
          // caves carve later
          data[idx(lx, y, lz)] = id;
        }
        // water/ice fill
        if (h < SEA_LEVEL) {
          for (let y = h + 1; y <= SEA_LEVEL; y++) {
            data[idx(lx, y, lz)] = (biome === BIOME_SNOW && y === SEA_LEVEL) ? B.ICE : B.WATER;
          }
        }
        // carve caves
        for (let y = 2; y < h; y++) {
          if (data[idx(lx, y, lz)] === B.BEDROCK) continue;
          const c = this.cave(wx * 0.06, y * 0.10, wz * 0.06);
          const c2 = this.cave(wx * 0.12, y * 0.18, wz * 0.12) * 0.5;
          if ((c + c2) > 0.55) data[idx(lx, y, lz)] = B.AIR;
        }
        // surface decorations
        if (data[idx(lx, h, lz)] !== B.AIR && h >= SEA_LEVEL && lx > 0 && lz > 0 && lx < CHUNK_SIZE - 1 && lz < CHUNK_SIZE - 1) {
          this.decorate(data, idx, lx, h, lz, wx, wz, biome, treeR);
        }
        // trees
        if (biome === BIOME_FOREST || biome === BIOME_PLAINS) {
          if (h > SEA_LEVEL && lx > 1 && lz > 1 && lx < CHUNK_SIZE - 2 && lz < CHUNK_SIZE - 2) {
            const t = this.tree(wx * 0.21, wz * 0.21);
            const dense = biome === BIOME_FOREST ? 0.78 : 0.92;
            if (t > 0.55 && treeR() > dense) {
              this.placeTree(data, lx, h + 1, lz, treeR);
            }
          }
        }
        if (biome === BIOME_DESERT && lx > 1 && lz > 1 && lx < CHUNK_SIZE - 2 && lz < CHUNK_SIZE - 2 && h >= SEA_LEVEL + 1) {
          if (treeR() > 0.985) {
            const ch = 2 + Math.floor(treeR() * 2);
            for (let dy = 0; dy < ch && h + 1 + dy < WORLD_H; dy++) data[idx(lx, h + 1 + dy, lz)] = B.CACTUS;
          }
        }
      }
    }

    // Apply overrides
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        for (let y = 0; y < WORLD_H; y++) {
          const ov = this.overrides.get(`${wx},${y},${wz}`);
          if (ov !== undefined) data[idx(lx, y, lz)] = ov;
        }
      }
    }
    return { cx, cz, data };
  }

  maybeOre(wx, y, wz, fallback) {
    const n = this.ore(wx * 0.12, y * 0.12, wz * 0.12);
    if (n > 0.78) {
      // diamond rare and deep
      if (y < 12 && n > 0.92) return B.DIAMOND_ORE;
      if (y < 18 && n > 0.88) return B.GOLD_ORE;
      if (y < 28 && n > 0.85) return B.IRON_ORE;
      return B.COAL_ORE;
    }
    if (n < -0.7 && y < 18) return B.GRAVEL;
    return fallback;
  }

  decorate(data, idx, lx, h, lz, wx, wz, biome, rng) {
    const top = data[idx(lx, h, lz)];
    const above = h + 1;
    if (above >= WORLD_H) return;
    if (top !== B.GRASS && top !== B.SNOW_GRASS) return;
    const r = rng();
    if (biome === BIOME_PLAINS && r > 0.92) {
      data[idx(lx, above, lz)] = (rng() > 0.5) ? B.FLOWER_RED : B.FLOWER_YELLOW;
    } else if (biome === BIOME_PLAINS && r > 0.7) {
      data[idx(lx, above, lz)] = B.TALL_GRASS;
    } else if (biome === BIOME_FOREST && r > 0.85) {
      data[idx(lx, above, lz)] = B.TALL_GRASS;
    }
  }

  placeTree(data, lx, ly, lz, r) {
    const idx = (x, y, z) => ((z * CHUNK_SIZE) + x) * WORLD_H + y;
    const trunk = 4 + Math.floor(r() * 2);
    for (let h = 0; h < trunk; h++) {
      if (ly + h >= WORLD_H) break;
      data[idx(lx, ly + h, lz)] = B.WOOD;
    }
    const top = ly + trunk;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          const x = lx + dx, y = top + dy, z = lz + dz;
          if (x < 0 || z < 0 || x >= CHUNK_SIZE || z >= CHUNK_SIZE || y < 0 || y >= WORLD_H) continue;
          if (data[idx(x, y, z)] === B.AIR) data[idx(x, y, z)] = B.LEAVES;
        }
      }
    }
    if (top + 2 < WORLD_H) data[idx(lx, top + 2, lz)] = B.LEAVES;
  }

  worldToChunk(wx, wz) {
    const cx = Math.floor(wx / CHUNK_SIZE);
    const cz = Math.floor(wz / CHUNK_SIZE);
    const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return { cx, cz, lx, lz };
  }

  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= WORLD_H) return B.AIR;
    const { cx, cz, lx, lz } = this.worldToChunk(wx, wz);
    const ch = this.chunks.get(this.key(cx, cz));
    if (!ch) return B.STONE;
    return ch.data[((lz * CHUNK_SIZE) + lx) * WORLD_H + wy];
  }

  setBlock(wx, wy, wz, id, opts = {}) {
    if (wy < 0 || wy >= WORLD_H) return false;
    const { cx, cz, lx, lz } = this.worldToChunk(wx, wz);
    const ch = this.ensureChunk(cx, cz);
    const i = ((lz * CHUNK_SIZE) + lx) * WORLD_H + wy;
    const prev = ch.data[i];
    if (prev === id) return false;
    ch.data[i] = id;
    this.overrides.set(`${wx},${wy},${wz}`, id);
    this.markDirtyAt(wx, wz);
    if (opts.persist !== false) this.persist();
    return true;
  }

  markDirtyAt(wx, wz) {
    const { cx, cz, lx, lz } = this.worldToChunk(wx, wz);
    this.dirty.add(this.key(cx, cz));
    if (lx === 0) this.dirty.add(this.key(cx - 1, cz));
    if (lx === CHUNK_SIZE - 1) this.dirty.add(this.key(cx + 1, cz));
    if (lz === 0) this.dirty.add(this.key(cx, cz - 1));
    if (lz === CHUNK_SIZE - 1) this.dirty.add(this.key(cx, cz + 1));
  }

  persist() {
    if (this._t) clearTimeout(this._t);
    this._t = setTimeout(() => {
      try {
        const arr = [];
        for (const [k, v] of this.overrides) arr.push([k, v]);
        localStorage.setItem('vc.world.v2.' + this.seed, JSON.stringify(arr));
        localStorage.setItem('vc.seed.v1', String(this.seed));
      } catch (e) { /* quota */ }
    }, 250);
  }

  load() {
    try {
      const raw = localStorage.getItem('vc.world.v2.' + this.seed);
      if (!raw) return;
      const arr = JSON.parse(raw);
      for (const [k, v] of arr) this.overrides.set(k, v);
    } catch (e) { /* ignore */ }
  }
}

export function loadOrCreateSeed() {
  try {
    const s = localStorage.getItem('vc.seed.v1');
    if (s) return Number(s) >>> 0;
  } catch (e) { /* ignore */ }
  const seed = (Math.floor(Math.random() * 0xffffffff)) >>> 0;
  try { localStorage.setItem('vc.seed.v1', String(seed)); } catch (e) {}
  return seed;
}

export function newRandomSeed() {
  return (Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
