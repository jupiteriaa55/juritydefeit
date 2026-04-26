// Voxel world: chunked storage + procedural terrain generation.
// Coordinates: world (x,y,z) integers. y is up, range [0, WORLD_H).
// Chunks are CHUNK_SIZE on x and z. Use a Map keyed by "cx,cz".

import { createNoise2D } from 'simplex-noise';
import * as B from './blocks.js';

export const CHUNK_SIZE = 16;
export const WORLD_H = 64;
export const SEA_LEVEL = 24;

function mulberry32(a) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class World {
  constructor(seed = 1337) {
    this.seed = seed >>> 0;
    const r = mulberry32(this.seed);
    this.noise2 = createNoise2D(r);
    this.noiseTree = createNoise2D(mulberry32(this.seed ^ 0x1234));
    this.chunks = new Map();
    this.dirty = new Set(); // chunk keys needing remesh
    // override store: chunks remember player edits even if regenerated
    this.overrides = new Map(); // "x,y,z" -> blockId (or 0)
  }

  key(cx, cz) { return `${cx},${cz}`; }

  heightAt(x, z) {
    // Multi-octave terrain
    const n1 = this.noise2(x * 0.012, z * 0.012);
    const n2 = this.noise2(x * 0.05, z * 0.05) * 0.5;
    const n3 = this.noise2(x * 0.18, z * 0.18) * 0.18;
    const v = (n1 + n2 + n3); // ~[-1.6, 1.6]
    const base = SEA_LEVEL + 4;
    return Math.max(2, Math.min(WORLD_H - 4, Math.floor(base + v * 10)));
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
        const h = this.heightAt(wx, wz);
        const beach = h <= SEA_LEVEL + 1;
        for (let y = 0; y <= h; y++) {
          let id = B.STONE;
          if (y === h) id = beach ? B.SAND : B.GRASS;
          else if (y >= h - 3) id = beach ? B.SAND : B.DIRT;
          data[idx(lx, y, lz)] = id;
        }
        // water fill
        if (h < SEA_LEVEL) {
          for (let y = h + 1; y <= SEA_LEVEL; y++) data[idx(lx, y, lz)] = B.WATER;
        }
        // trees on grass, sparsely; avoid edges
        if (!beach && h > SEA_LEVEL && lx > 1 && lz > 1 && lx < CHUNK_SIZE - 2 && lz < CHUNK_SIZE - 2) {
          const t = this.noiseTree(wx * 0.21, wz * 0.21);
          if (t > 0.55 && treeR() > 0.86) {
            this.placeTree(data, lx, h + 1, lz, treeR);
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
    if (!ch) return B.STONE; // unloaded → treat as solid for collisions sanity
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

  // Persistence — store overrides only, in compact JSON.
  persist() {
    if (this._t) clearTimeout(this._t);
    this._t = setTimeout(() => {
      try {
        const arr = [];
        for (const [k, v] of this.overrides) arr.push([k, v]);
        localStorage.setItem('vc.world.v1.' + this.seed, JSON.stringify(arr));
      } catch (e) { /* quota */ }
    }, 250);
  }

  load() {
    try {
      const raw = localStorage.getItem('vc.world.v1.' + this.seed);
      if (!raw) return;
      const arr = JSON.parse(raw);
      for (const [k, v] of arr) this.overrides.set(k, v);
    } catch (e) { /* ignore */ }
  }
}
