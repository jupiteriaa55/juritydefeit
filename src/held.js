// First-person held-item view. Renders a small mesh in the bottom-right
// corner using a separate scene + perspective camera, drawn after the main
// scene without clearing the depth buffer.
//
// Tools (pickaxe / sword / shovel / axe / hoe) are built as TRUE 3D extruded
// pixel-art icons: a 16x16 sprite is rasterized and each opaque pixel becomes
// a small textured cube — the same technique Minecraft uses for held items.

import * as THREE from 'three';
import { atlasTexture, uvFor } from './textures.js';
import * as B from './blocks.js';

// ---------- Pixel-art icons ----------
//
// Each icon is a 16x16 grid. Colors are stored as 24-bit hex. `null` = empty.
// The Y axis grows downward (top of icon = row 0). When rendered, we flip
// vertically so the head is up.
const W = 0x6b4a25; // wood handle dark
const H = 0x8a6135; // wood handle main
const I = 0xa57441; // wood handle light
const S = 0x8a8a8a; // stone main
const D = 0x6c6c6c; // stone dark
const L = 0xa6a6a6; // stone light
const X = 0xe0e0e0; // metal shine / sword edge
const M = 0xb1b1b1; // metal light
const N = 0x707070; // metal dark
const G = 0xc7a44a; // gold guard
const E = 0xefefef; // sword edge bright

function P(grid) {
  // build an icon from a 16-line array of 16-char strings.
  // legend: '.' empty, '#' main, etc. — caller passes a map.
  return grid;
}

function spriteFromGrid(grid, legend) {
  const out = [];
  for (let y = 0; y < 16; y++) {
    const row = grid[y] || '................';
    for (let x = 0; x < 16; x++) {
      const ch = row[x];
      if (!ch || ch === '.') continue;
      const col = legend[ch];
      if (col === undefined) continue;
      out.push({ x, y, c: col });
    }
  }
  return out;
}

const PICKAXE = spriteFromGrid([
  '..ddd......ddd..',
  '.dSSSdddddSSSd..',
  '.dSlSSSlSlSSSd..',
  '.dSSSlSSSlSSSd..',
  '..dSSSSSSSSSd...',
  '....ddSSSdd.....',
  '......hHh.......',
  '......hHh.......',
  '......hHh.......',
  '......hHh.......',
  '......hHh.......',
  '......hHh.......',
  '......hHh.......',
  '......hHh.......',
  '......hwh.......',
  '.......h........'
], { d: D, S: S, l: L, h: W, H: H, w: I });

const SWORD = spriteFromGrid([
  '...........XXX..',
  '..........XEEX..',
  '.........XEEX...',
  '........XEEX....',
  '.......XEEX.....',
  '......XEEX......',
  '.....XEEX.......',
  '....XEEX........',
  '...GGEX.........',
  '..GgGGg.........',
  '.HhHhh..........',
  'HhHhh...........',
  '.HhH............',
  '..H.............',
  '................',
  '................'
], { X: X, E: E, G: G, g: 0xb88a25, H: W, h: H });

const SHOVEL = spriteFromGrid([
  '......NMNN......',
  '.....NMmMMN.....',
  '.....NmMMMN.....',
  '.....NMMMmN.....',
  '.....NNMMNN.....',
  '......hHHh......',
  '......hHHh......',
  '......hHHh......',
  '......hHHh......',
  '......hHHh......',
  '......hHHh......',
  '......hHHh......',
  '......hHHh......',
  '......hHHh......',
  '......hwwh......',
  '.......hh.......'
], { N: N, M: M, m: X, h: W, H: H, w: I });

const AXE = spriteFromGrid([
  '...NMMNN........',
  '..NMmmMMN.......',
  '.NMmmmmMN.......',
  '.NMmmmmMN.......',
  '..NMmMMNh.......',
  '...NMMNhH.......',
  '......hHh.......',
  '......hHh.......',
  '......hHh.......',
  '......hHh.......',
  '......hHh.......',
  '......hHh.......',
  '......hHh.......',
  '......hHh.......',
  '......hwh.......',
  '.......h........'
], { N: N, M: M, m: X, h: W, H: H, w: I });

// Builds a textured 3D model from a sprite (pixel array {x, y, c}).
// Each pixel becomes a 1/16 cube glued together to form an extruded icon.
// Result is a single THREE.Mesh with vertex colors (no texture lookups).
function buildSpriteMesh(sprite, depth = 0.10) {
  if (sprite.length === 0) return new THREE.Group();
  const px = 1 / 16; // pixel size
  const dz = depth;  // extrusion depth in scene units

  const positions = [];
  const colors = [];
  const indices = [];
  let vIdx = 0;

  function addQuad(p0, p1, p2, p3, color) {
    positions.push(...p0, ...p1, ...p2, ...p3);
    for (let k = 0; k < 4; k++) colors.push(...color);
    indices.push(vIdx, vIdx + 1, vIdx + 2, vIdx, vIdx + 2, vIdx + 3);
    vIdx += 4;
  }

  // For each pixel, emit a small cube. Center the icon around (0,0).
  // Pixel (x, y) -> world (cx, cy):
  //   cx = (x - 7.5) / 16
  //   cy = (7.5 - y) / 16   (flip vertically so top of icon = up)
  const map = new Map();
  for (const p of sprite) map.set(`${p.x},${p.y}`, p.c);
  function has(x, y) { return map.has(`${x},${y}`); }

  for (const p of sprite) {
    const cx = (p.x - 7.5) * px;
    const cy = (7.5 - p.y) * px;
    const r = ((p.c >> 16) & 255) / 255;
    const g = ((p.c >> 8) & 255) / 255;
    const b = (p.c & 255) / 255;
    const col = [r, g, b];
    const colDark = [r * 0.78, g * 0.78, b * 0.78];
    const colLite = [Math.min(1, r * 1.15), Math.min(1, g * 1.15), Math.min(1, b * 1.15)];
    const x0 = cx - px / 2, x1 = cx + px / 2;
    const y0 = cy - px / 2, y1 = cy + px / 2;
    const z0 = -dz / 2, z1 = dz / 2;
    // Front (+z) and back (-z) always
    addQuad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], col);
    addQuad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], colDark);
    // Sides only if neighbour is empty (saves verts)
    if (!has(p.x + 1, p.y)) addQuad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], colLite);
    if (!has(p.x - 1, p.y)) addQuad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], colDark);
    if (!has(p.x, p.y + 1)) addQuad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], colDark);
    if (!has(p.x, p.y - 1)) addQuad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], colLite);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  // Tilt slightly so the tool reads as 3D, not flat
  mesh.rotation.set(0, 0, -Math.PI / 6);
  mesh.scale.setScalar(1.05);
  return mesh;
}

function buildHandHeldBlock(blockId) {
  // Custom box geometry with per-face UVs taken from atlas — true textured cube.
  const g = new THREE.BoxGeometry(0.55, 0.55, 0.55);
  const mat = new THREE.MeshLambertMaterial({ map: atlasTexture, transparent: false });
  const faces = ['side', 'side', 'top', 'bottom', 'side', 'side'];
  const uvAttr = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    const [u0, v0, u1, v1] = uvFor(blockId, faces[f]);
    const i0 = f * 4;
    uvAttr.setXY(i0 + 0, u0, v1);
    uvAttr.setXY(i0 + 1, u1, v1);
    uvAttr.setXY(i0 + 2, u0, v0);
    uvAttr.setXY(i0 + 3, u1, v0);
  }
  uvAttr.needsUpdate = true;
  return new THREE.Mesh(g, mat);
}

const TOOL_FOR_BLOCK = {
  [B.STONE]: 'pickaxe', [B.COBBLE]: 'pickaxe', [B.BRICK]: 'pickaxe', [B.OBSIDIAN]: 'pickaxe',
  [B.GOLD_ORE]: 'pickaxe', [B.IRON_ORE]: 'pickaxe', [B.COAL_ORE]: 'pickaxe', [B.DIAMOND_ORE]: 'pickaxe',
  [B.DIRT]: 'shovel', [B.SAND]: 'shovel', [B.GRAVEL]: 'shovel', [B.SNOW]: 'shovel', [B.PATH]: 'shovel',
  [B.WOOD]: 'axe', [B.PLANK]: 'axe', [B.LEAVES]: 'axe', [B.ROOF]: 'axe',
  [B.GRASS]: 'shovel', [B.SNOW_GRASS]: 'shovel'
};

export class Held {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 10);
    this.camera.position.set(0, 0, 1.6);
    this.camera.lookAt(0, 0, 0);
    const amb = new THREE.AmbientLight(0xffffff, 0.65); this.scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(0.6, 1, 0.7); this.scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xfff0c8, 0.35);
    dir2.position.set(-0.8, 0.4, 0.5); this.scene.add(dir2);
    this.holder = new THREE.Group();
    this.holder.position.set(0.55, -0.45, 0);
    this.holder.rotation.set(-0.2, -0.4, 0.3);
    this.scene.add(this.holder);
    this.current = null;
    this.swing = 0;
    this.tool = 'pickaxe';
    this.blockId = null;
    this._cache = {};
  }

  _getTool(name) {
    if (!this._cache[name]) {
      const sprite = name === 'sword' ? SWORD
        : name === 'shovel' ? SHOVEL
        : name === 'axe' ? AXE
        : PICKAXE;
      this._cache[name] = buildSpriteMesh(sprite, 0.09);
    }
    return this._cache[name].clone();
  }

  setHeld(blockId, alwaysShowAsBlock = false) {
    while (this.holder.children.length) this.holder.remove(this.holder.children[0]);
    let mesh;
    if (alwaysShowAsBlock || this._isPlaceable(blockId)) {
      mesh = buildHandHeldBlock(blockId);
      this.tool = 'block';
      this.blockId = blockId;
    } else {
      this.tool = 'pickaxe';
      mesh = this._getTool('pickaxe');
    }
    this.holder.add(mesh);
  }

  _isPlaceable(blockId) {
    return blockId !== null && blockId !== undefined && blockId !== 0;
  }

  showToolFor(blockId) {
    const t = TOOL_FOR_BLOCK[blockId] || 'pickaxe';
    while (this.holder.children.length) this.holder.remove(this.holder.children[0]);
    this.holder.add(this._getTool(t));
    this.tool = t;
  }

  triggerSwing() { this.swing = 1; }

  update(dt) {
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 4);
    const s = Math.sin(this.swing * Math.PI);
    this.holder.rotation.x = -0.2 - s * 1.0;
    this.holder.rotation.y = -0.4 + s * 0.3;
    this.holder.position.y = -0.45 + s * 0.1;
  }

  render() {
    const gl = this.renderer;
    const w = gl.domElement.clientWidth;
    const h = gl.domElement.clientHeight;
    const size = Math.min(w, h) * 0.34;
    gl.autoClear = false;
    gl.clearDepth();
    gl.setViewport(w - size, 0, size, size);
    gl.setScissor(w - size, 0, size, size);
    gl.setScissorTest(true);
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();
    gl.render(this.scene, this.camera);
    gl.setScissorTest(false);
    gl.setViewport(0, 0, w, h);
    gl.autoClear = true;
  }
}
