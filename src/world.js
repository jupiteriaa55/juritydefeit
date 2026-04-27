// Мир кладбища: сетка GRID_SIZE×GRID_SIZE клеток.
// Состояние клетки хранится в Uint16Array (одно число на клетку), что укладывается
// в десятки килобайт даже для 200×200 = 40 000 клеток — этого достаточно для мобильного.
//
// Геометрия:
//  • один большой газон (плоскость) рисуется одним мешем;
//  • объекты (надгробия, цветы, дорожки и т.д.) кладутся как обычные Group/Mesh,
//    они «дешёвые» (low-poly, без текстур), а реально на карте их обычно сотни,
//    а не десятки тысяч, поэтому отдельные меши + frustum culling работают быстро.

import * as THREE from 'three';
import { CELL, ITEM_DEFS, defByCellId, buildItemMesh, buildPitMesh, buildFilledMesh } from './items.js';
import { getGroundTexture } from './textures.js';

export const GRID_SIZE = 200;
export const CELL_SIZE = 1;

export class World {
  constructor(scene) {
    this.scene = scene;
    this.size = GRID_SIZE;
    this.cells = new Uint16Array(GRID_SIZE * GRID_SIZE); // 0 = трава
    this.meta = new Map(); // cellIndex -> { name?: string, orderId?: string }
    this.objects = new Map(); // cellIndex -> THREE.Object3D
    this.root = new THREE.Group();
    this.scene.add(this.root);

    // Газон (большая плоская поверхность с мягким "мультяшным" цветом).
    this._buildGround();

    // Контур карты (граница участка).
    this._buildBorder();

    // Хайлайт выбранной клетки.
    this.highlight = this._buildHighlight();
    this.highlight.visible = false;
    this.root.add(this.highlight);
  }

  _buildGround() {
    const half = (GRID_SIZE * CELL_SIZE) / 2;
    const geo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, 1, 1);
    const tex = getGroundTexture(GRID_SIZE / 4); // ≈4 клетки на повтор
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(half - 0.5, 0, half - 0.5);
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.ground = mesh;

    // Декоративные тёмные полосы (имитация участков) — лёгкая визуальная ориентация.
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.06 });
    for (let i = 0; i <= GRID_SIZE; i += 10) {
      const lineH = new THREE.Mesh(new THREE.PlaneGeometry(GRID_SIZE, 0.05), stripeMat);
      lineH.rotation.x = -Math.PI / 2;
      lineH.position.set(half - 0.5, 0.01, i - 0.5);
      this.root.add(lineH);
      const lineV = new THREE.Mesh(new THREE.PlaneGeometry(0.05, GRID_SIZE), stripeMat);
      lineV.rotation.x = -Math.PI / 2;
      lineV.position.set(i - 0.5, 0.01, half - 0.5);
      this.root.add(lineV);
    }
  }

  _buildBorder() {
    const half = (GRID_SIZE * CELL_SIZE) / 2;
    const geo = new THREE.BoxGeometry(GRID_SIZE + 0.4, 0.4, 0.2);
    const mat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a, flatShading: true });
    const m1 = new THREE.Mesh(geo, mat); m1.position.set(half - 0.5, 0.2, -0.6); this.root.add(m1);
    const m2 = new THREE.Mesh(geo, mat); m2.position.set(half - 0.5, 0.2, GRID_SIZE - 0.4); this.root.add(m2);
    const geo2 = new THREE.BoxGeometry(0.2, 0.4, GRID_SIZE + 0.4);
    const m3 = new THREE.Mesh(geo2, mat); m3.position.set(-0.6, 0.2, half - 0.5); this.root.add(m3);
    const m4 = new THREE.Mesh(geo2, mat); m4.position.set(GRID_SIZE - 0.4, 0.2, half - 0.5); this.root.add(m4);
  }

  _buildHighlight() {
    const g = new THREE.Group();
    const geo = new THREE.PlaneGeometry(0.95, 0.95);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.45 });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.02;
    g.add(m);
    return g;
  }

  inBounds(x, z) {
    return x >= 0 && x < GRID_SIZE && z >= 0 && z < GRID_SIZE;
  }

  index(x, z) { return z * GRID_SIZE + x; }

  get(x, z) {
    if (!this.inBounds(x, z)) return undefined;
    return this.cells[this.index(x, z)];
  }

  setHighlight(x, z, visible = true) {
    if (visible && this.inBounds(x, z)) {
      this.highlight.position.set(x, 0, z);
      this.highlight.visible = true;
    } else {
      this.highlight.visible = false;
    }
  }

  // Поставить клетку: itemId — id из ITEM_DEFS либо CELL.PIT/CELL.FILLED/CELL.GRASS.
  set(x, z, value, meta = null) {
    if (!this.inBounds(x, z)) return false;
    const idx = this.index(x, z);
    const prev = this.cells[idx];
    if (prev === value) {
      if (meta) this.meta.set(idx, { ...(this.meta.get(idx) || {}), ...meta });
      return true;
    }
    this.cells[idx] = value;

    // Удалить предыдущий визуал.
    const old = this.objects.get(idx);
    if (old) {
      this.root.remove(old);
      old.traverse?.(o => { o.geometry?.dispose?.(); });
      this.objects.delete(idx);
    }

    // Поставить новый.
    let mesh = null;
    if (value === CELL.PIT) {
      mesh = buildPitMesh();
    } else if (value === CELL.FILLED) {
      mesh = buildFilledMesh();
    } else if (value !== CELL.GRASS) {
      const def = defByCellId(value);
      if (def) mesh = buildItemMesh(def.id);
    }
    if (mesh) {
      mesh.position.set(x, 0, z);
      this.root.add(mesh);
      this.objects.set(idx, mesh);
    }

    if (meta) this.meta.set(idx, meta); else this.meta.delete(idx);
    return true;
  }

  setMeta(x, z, m) {
    const idx = this.index(x, z);
    this.meta.set(idx, { ...(this.meta.get(idx) || {}), ...m });
  }
  getMeta(x, z) {
    return this.meta.get(this.index(x, z)) || null;
  }

  // Поиск свободной зоны рядом для собаки и т.п.
  randomGrass(rand) {
    for (let i = 0; i < 50; i++) {
      const x = Math.floor(rand() * GRID_SIZE);
      const z = Math.floor(rand() * GRID_SIZE);
      if (this.get(x, z) === CELL.GRASS) return { x, z };
    }
    return { x: 0, z: 0 };
  }
}

// Фолбэки на случай отсутствия мейкеров.
function _pitFallback() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 0.95), new THREE.MeshLambertMaterial({ color: 0x2a1a10 }));
  m.position.y = -0.1; g.add(m); return g;
}
function _filledFallback() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.12, 0.95), new THREE.MeshLambertMaterial({ color: 0x6b4a2c }));
  m.position.y = 0.06; g.add(m); return g;
}
