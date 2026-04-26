// Build a per-chunk BufferGeometry from voxel data with face culling.
// Output uses a single texture atlas; each face gets UVs from textures.uvFor.
// Opaque faces and transparent faces are emitted into two geometries so we can
// render transparency correctly.

import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_H } from './world.js';
import { uvFor } from './textures.js';
import * as B from './blocks.js';
import { isOpaque, isTransparent, BLOCKS } from './blocks.js';

// Face data: normal, four corner offsets (a unit cube spans [0..1]).
// Order: top(+y), bottom(-y), +x, -x, +z, -z. UVs follow standard.
const FACES = [
  { name: 'top',    n: [0, 1, 0], v: [[0,1,0],[1,1,0],[1,1,1],[0,1,1]], shade: 1.0 },
  { name: 'bottom', n: [0,-1, 0], v: [[0,0,1],[1,0,1],[1,0,0],[0,0,0]], shade: 0.55 },
  { name: 'side',   n: [1, 0, 0], v: [[1,0,1],[1,1,1],[1,1,0],[1,0,0]], shade: 0.85 },
  { name: 'side',   n: [-1,0, 0], v: [[0,0,0],[0,1,0],[0,1,1],[0,0,1]], shade: 0.85 },
  { name: 'side',   n: [0, 0, 1], v: [[0,0,1],[0,1,1],[1,1,1],[1,0,1]], shade: 0.78 },
  { name: 'side',   n: [0, 0,-1], v: [[1,0,0],[1,1,0],[0,1,0],[0,0,0]], shade: 0.78 }
];

function isVisibleNeighbor(self, neigh) {
  if (neigh === B.AIR) return true;
  const nb = BLOCKS[neigh];
  if (!nb) return true;
  // For a transparent block, an opaque neighbor hides it (standard).
  // For an opaque block, a transparent neighbor exposes it.
  if (isOpaque(self)) return isTransparent(neigh);
  // self is transparent: hide face if neighbor is the same kind (water-water etc.)
  if (self === neigh) return false;
  return isTransparent(neigh);
}

function pushFace(arr, ox, oy, oz, face, blockId, lampBoost) {
  const [u0, v0, u1, v1] = uvFor(blockId, face.name);
  const sh = face.shade * (lampBoost ? 1.0 : 1.0);
  const cR = sh, cG = sh, cB = sh;
  const corners = face.v;
  const uvs = [[u0, v0], [u0, v1], [u1, v1], [u1, v0]];
  const baseIdx = arr.positions.length / 3;
  for (let i = 0; i < 4; i++) {
    arr.positions.push(ox + corners[i][0], oy + corners[i][1], oz + corners[i][2]);
    arr.normals.push(face.n[0], face.n[1], face.n[2]);
    arr.uvs.push(uvs[i][0], uvs[i][1]);
    arr.colors.push(cR, cG, cB);
  }
  arr.indices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
}

export function meshChunk(world, chunk) {
  const opaque = { positions: [], normals: [], uvs: [], colors: [], indices: [] };
  const trans  = { positions: [], normals: [], uvs: [], colors: [], indices: [] };

  const cxBase = chunk.cx * CHUNK_SIZE;
  const czBase = chunk.cz * CHUNK_SIZE;
  const data = chunk.data;
  const idx = (lx, y, lz) => ((lz * CHUNK_SIZE) + lx) * WORLD_H + y;

  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let y = 0; y < WORLD_H; y++) {
        const id = data[idx(lx, y, lz)];
        if (id === B.AIR) continue;
        const wx = cxBase + lx;
        const wz = czBase + lz;
        // For each face check neighbour
        for (let f = 0; f < FACES.length; f++) {
          const face = FACES[f];
          const nx = wx + face.n[0];
          const ny = y + face.n[1];
          const nz = wz + face.n[2];
          let neigh;
          if (ny < 0 || ny >= WORLD_H) {
            neigh = B.AIR;
          } else if (face.n[0] === 0 && face.n[2] === 0) {
            neigh = data[idx(lx, ny, lz)];
          } else {
            neigh = world.getBlock(nx, ny, nz);
          }
          if (!isVisibleNeighbor(id, neigh)) continue;
          const target = isOpaque(id) ? opaque : trans;
          pushFace(target, lx, y, lz, face, id, false);
        }
      }
    }
  }
  return { opaque: toGeo(opaque), trans: toGeo(trans) };
}

function toGeo(a) {
  if (a.indices.length === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(a.positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(a.normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(a.uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(a.colors, 3));
  g.setIndex(a.indices);
  g.computeBoundingSphere();
  return g;
}
