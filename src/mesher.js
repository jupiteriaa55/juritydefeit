// Build a per-chunk BufferGeometry from voxel data with face culling.
// Output uses a single texture atlas. Opaque vs transparent meshes are
// emitted separately. Cross blocks (flowers, torches) render as two crossed
// quads. A `wave` per-vertex attribute drives shader animation.

import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_H } from './world.js';
import { uvFor } from './textures.js';
import * as B from './blocks.js';
import { isOpaque, isTransparent, isCross, BLOCKS, waveOf } from './blocks.js';

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
  if (isCross(neigh)) return true;
  const nb = BLOCKS[neigh];
  if (!nb) return true;
  if (isOpaque(self)) return isTransparent(neigh);
  if (self === neigh) return false;
  return isTransparent(neigh);
}

function pushFace(arr, ox, oy, oz, face, blockId, isTop) {
  const [u0, v0, u1, v1] = uvFor(blockId, face.name);
  const sh = face.shade;
  const corners = face.v;
  const uvs = [[u0, v0], [u0, v1], [u1, v1], [u1, v0]];
  const baseIdx = arr.positions.length / 3;
  // wave: top vertices of grass-tagged blocks sway, leaves all sway, water all
  const w = waveOf(blockId);
  for (let i = 0; i < 4; i++) {
    arr.positions.push(ox + corners[i][0], oy + corners[i][1], oz + corners[i][2]);
    arr.normals.push(face.n[0], face.n[1], face.n[2]);
    arr.uvs.push(uvs[i][0], uvs[i][1]);
    arr.colors.push(sh, sh, sh);
    let vw = 0;
    if (w === 2) vw = 2; // leaves: all corners sway
    else if (w === 3) vw = (corners[i][1] >= 0.99 ? 3 : 0); // water: top only
    arr.waves.push(vw);
  }
  arr.indices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
}

function pushCross(arr, ox, oy, oz, blockId) {
  const [u0, v0, u1, v1] = uvFor(blockId, 'side');
  const w = waveOf(blockId) || (blockId === B.TORCH ? 0 : 1); // crosses sway slightly
  // two quads forming an X
  const planes = [
    [[0.05, 0, 0.05], [0.95, 0, 0.95], [0.95, 1, 0.95], [0.05, 1, 0.05]],
    [[0.05, 0, 0.95], [0.95, 0, 0.05], [0.95, 1, 0.05], [0.05, 1, 0.95]]
  ];
  const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  for (const verts of planes) {
    const baseIdx = arr.positions.length / 3;
    for (let i = 0; i < 4; i++) {
      arr.positions.push(ox + verts[i][0], oy + verts[i][1], oz + verts[i][2]);
      arr.normals.push(0, 1, 0);
      arr.uvs.push(uvs[i][0], uvs[i][1]);
      arr.colors.push(1, 1, 1);
      const vw = (verts[i][1] >= 0.99 ? w : 0);
      arr.waves.push(vw);
    }
    // double-sided: also push reversed face
    arr.indices.push(baseIdx, baseIdx + 1, baseIdx + 2, baseIdx, baseIdx + 2, baseIdx + 3);
    arr.indices.push(baseIdx, baseIdx + 2, baseIdx + 1, baseIdx, baseIdx + 3, baseIdx + 2);
  }
}

export function meshChunk(world, chunk) {
  const opaque = mkArr();
  const trans  = mkArr();

  const cxBase = chunk.cx * CHUNK_SIZE;
  const czBase = chunk.cz * CHUNK_SIZE;
  const data = chunk.data;
  const idx = (lx, y, lz) => ((lz * CHUNK_SIZE) + lx) * WORLD_H + y;

  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let y = 0; y < WORLD_H; y++) {
        const id = data[idx(lx, y, lz)];
        if (id === B.AIR) continue;
        if (isCross(id)) {
          pushCross(trans, lx, y, lz, id);
          continue;
        }
        const wx = cxBase + lx;
        const wz = czBase + lz;
        for (let f = 0; f < FACES.length; f++) {
          const face = FACES[f];
          const ny = y + face.n[1];
          let neigh;
          if (ny < 0 || ny >= WORLD_H) {
            neigh = B.AIR;
          } else if (face.n[0] === 0 && face.n[2] === 0) {
            neigh = data[idx(lx, ny, lz)];
          } else {
            neigh = world.getBlock(wx + face.n[0], ny, wz + face.n[2]);
          }
          if (!isVisibleNeighbor(id, neigh)) continue;
          const target = isOpaque(id) ? opaque : trans;
          pushFace(target, lx, y, lz, face, id, face.name === 'top');
        }
      }
    }
  }
  return { opaque: toGeo(opaque), trans: toGeo(trans) };
}

function mkArr() { return { positions: [], normals: [], uvs: [], colors: [], waves: [], indices: [] }; }

function toGeo(a) {
  if (a.indices.length === 0) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(a.positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(a.normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(a.uvs, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(a.colors, 3));
  g.setAttribute('wave', new THREE.Float32BufferAttribute(a.waves, 1));
  g.setIndex(a.indices);
  g.computeBoundingSphere();
  return g;
}
