// Мир кладбища: сетка GRID_SIZE×GRID_SIZE клеток + участки (plots), внутри которых
// разрешено копать могилы. Снаружи участков — газон с возможностью ставить
// цветы, дорожки и декор, но не могилы.

import * as THREE from 'three';
import { CELL, ITEM_DEFS, defByCellId, buildItemMesh, buildPitMesh, buildFilledMesh } from './items.js';
import { getGroundTexture, getPlotTexture } from './textures.js';

export const GRID_SIZE = 200;
export const CELL_SIZE = 1;

// Уровень участка: чем выше, тем «престижнее» зона.
// 0 — нет участка (нельзя копать).
// 1 — обычный, 2 — средний, 3 — богатый, 4 — VIP-склеп.
export const PLOT = {
  NONE: 0,
  POOR: 1,
  STANDARD: 2,
  RICH: 3,
  VIP: 4,
};

const PLOT_COLORS = {
  1: '#cdb88f', // светлый — простой
  2: '#b89968', // средний
  3: '#a07a48', // тёмный богатый
  4: '#8a5a32', // VIP — почти чёрная земля
};

function plotName(level) {
  return { 1: 'Простой', 2: 'Стандартный', 3: 'Богатый', 4: 'VIP-склеп' }[level] || '—';
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.size = GRID_SIZE;
    this.cells = new Uint16Array(GRID_SIZE * GRID_SIZE); // 0 = трава
    this.zones = new Uint8Array(GRID_SIZE * GRID_SIZE);  // 0 = вне участка
    this.meta = new Map(); // cellIndex -> { name?: string, orderId?: string }
    this.objects = new Map(); // cellIndex -> THREE.Object3D
    this.plots = []; // [{x0,z0,x1,z1, level, label3d}]
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this._buildGround();
    this._generatePlots();
    this._buildPlotsVisuals();
    this._buildBorder();
    this._buildEntranceGate();

    this.highlight = this._buildHighlight();
    this.highlight.visible = false;
    this.root.add(this.highlight);
  }

  _buildGround() {
    const half = (GRID_SIZE * CELL_SIZE) / 2;
    const geo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, 1, 1);
    const tex = getGroundTexture(GRID_SIZE / 6);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex, flatShading: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(half - 0.5, 0, half - 0.5);
    mesh.receiveShadow = true;
    this.root.add(mesh);
    this.ground = mesh;
  }

  _generatePlots() {
    // Раскладка кладбища: центральная аллея сверху-вниз, ряды участков слева/справа.
    // Размеры подобраны под 200×200 — игроку всегда есть, куда копать, но участки
    // ограничены (не вся карта).
    const cx = GRID_SIZE / 2;
    const cz = GRID_SIZE / 2;
    const layout = [
      // VIP — два больших участка у входа
      { x: cx - 22, z: cz - 38, w: 18, h: 14, level: PLOT.VIP, name: 'VIP-склеп «Юпитер»' },
      { x: cx + 4,  z: cz - 38, w: 18, h: 14, level: PLOT.VIP, name: 'VIP-склеп «Афина»' },
      // Богатые
      { x: cx - 28, z: cz - 18, w: 22, h: 14, level: PLOT.RICH,     name: 'Богатый сектор «Закат»' },
      { x: cx + 6,  z: cz - 18, w: 22, h: 14, level: PLOT.RICH,     name: 'Богатый сектор «Рассвет»' },
      // Стандартные ряды (центральный двойной)
      { x: cx - 28, z: cz + 2, w: 22, h: 14, level: PLOT.STANDARD, name: 'Сектор «Берёзовый»' },
      { x: cx + 6,  z: cz + 2, w: 22, h: 14, level: PLOT.STANDARD, name: 'Сектор «Дубовый»' },
      // Бедные
      { x: cx - 36, z: cz + 22, w: 26, h: 14, level: PLOT.POOR, name: 'Простой сектор' },
      { x: cx + 10, z: cz + 22, w: 26, h: 14, level: PLOT.POOR, name: 'Сектор «Туман»' },
    ];

    for (const p of layout) {
      const x0 = Math.max(2, Math.floor(p.x));
      const z0 = Math.max(2, Math.floor(p.z));
      const x1 = Math.min(GRID_SIZE - 3, x0 + p.w - 1);
      const z1 = Math.min(GRID_SIZE - 3, z0 + p.h - 1);
      const plot = { x0, z0, x1, z1, level: p.level, name: p.name };
      this.plots.push(plot);
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          this.zones[z * GRID_SIZE + x] = p.level;
        }
      }
    }
  }

  _buildPlotsVisuals() {
    // Для каждого участка рисуем «вспаханный» прямоугольник чуть выше газона.
    for (const p of this.plots) {
      const w = (p.x1 - p.x0 + 1);
      const h = (p.z1 - p.z0 + 1);
      const tex = getPlotTexture(Math.max(2, w / 4));
      const mat = new THREE.MeshLambertMaterial({
        color: PLOT_COLORS[p.level] || '#a07a48',
        map: tex,
        flatShading: true,
      });
      const geo = new THREE.PlaneGeometry(w, h);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(p.x0 + w / 2 - 0.5, 0.005, p.z0 + h / 2 - 0.5);
      mesh.receiveShadow = true;
      this.root.add(mesh);

      // Контур из тёмных «брёвнышек» по краям участка.
      const border = this._buildPlotBorder(p);
      this.root.add(border);

      // Лейбл-табличка с названием участка.
      const label = this._buildPlotLabel(p);
      this.root.add(label);
    }
  }

  _buildPlotBorder(p) {
    const g = new THREE.Group();
    const w = p.x1 - p.x0 + 1, h = p.z1 - p.z0 + 1;
    const cx = p.x0 + w / 2 - 0.5, cz = p.z0 + h / 2 - 0.5;
    const m = new THREE.MeshLambertMaterial({ color: 0x6c4a26, flatShading: true });
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.18, 0.18), m);
    top.position.set(cx, 0.09, cz - h / 2 - 0.1);
    const bot = top.clone(); bot.position.set(cx, 0.09, cz + h / 2 + 0.1);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, h + 0.4), m);
    left.position.set(cx - w / 2 - 0.1, 0.09, cz);
    const right = left.clone(); right.position.set(cx + w / 2 + 0.1, 0.09, cz);
    [top, bot, left, right].forEach(b => { b.castShadow = true; b.receiveShadow = true; g.add(b); });
    return g;
  }

  _buildPlotLabel(p) {
    // Маленькая табличка с названием участка над землёй, как «постовой указатель».
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 80;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#dab26a'; ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    ctx.fillStyle = '#f5e6c8';
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.name, canvas.width / 2, canvas.height / 2 - 4);
    ctx.font = '14px Georgia, serif';
    ctx.fillStyle = '#dab26a';
    ctx.fillText(plotName(p.level), canvas.width / 2, canvas.height / 2 + 22);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false }));
    sprite.scale.set(7, 2.2, 1);
    sprite.position.set(p.x0 + (p.x1 - p.x0 + 1) / 2 - 0.5, 3.2, p.z0 - 1.5);
    return sprite;
  }

  _buildBorder() {
    const half = (GRID_SIZE * CELL_SIZE) / 2;
    const m = new THREE.MeshLambertMaterial({ color: 0x2a1c10, flatShading: true });
    const geo = new THREE.BoxGeometry(GRID_SIZE + 0.4, 0.5, 0.25);
    const m1 = new THREE.Mesh(geo, m); m1.position.set(half - 0.5, 0.25, -0.6); this.root.add(m1);
    const m2 = new THREE.Mesh(geo, m); m2.position.set(half - 0.5, 0.25, GRID_SIZE - 0.4); this.root.add(m2);
    const geo2 = new THREE.BoxGeometry(0.25, 0.5, GRID_SIZE + 0.4);
    const m3 = new THREE.Mesh(geo2, m); m3.position.set(-0.6, 0.25, half - 0.5); this.root.add(m3);
    const m4 = new THREE.Mesh(geo2, m); m4.position.set(GRID_SIZE - 0.4, 0.25, half - 0.5); this.root.add(m4);
  }

  _buildEntranceGate() {
    // Ворота сверху, у самого входа.
    const g = new THREE.Group();
    const irMat = new THREE.MeshLambertMaterial({ color: 0x222428, flatShading: true });
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0x9c958a, flatShading: true });
    const goldMat = new THREE.MeshLambertMaterial({ color: 0xe6b240, flatShading: true });

    // 2 каменные пилона
    for (const dx of [-3, 3]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 4, 1.5), stoneMat);
      pillar.position.set(GRID_SIZE / 2 + dx, 2, -1.5);
      pillar.castShadow = true;
      g.add(pillar);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 2), goldMat);
      cap.position.set(GRID_SIZE / 2 + dx, 4.2, -1.5);
      g.add(cap);
    }
    // Арка
    const arc = new THREE.Mesh(new THREE.TorusGeometry(3, 0.18, 6, 24, Math.PI), irMat);
    arc.position.set(GRID_SIZE / 2, 4, -1.5);
    arc.rotation.x = Math.PI / 2; arc.rotation.z = Math.PI;
    g.add(arc);

    this.root.add(g);
  }

  _buildHighlight() {
    const g = new THREE.Group();
    const geo = new THREE.PlaneGeometry(0.95, 0.95);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.5 });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.04;
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

  zoneAt(x, z) {
    if (!this.inBounds(x, z)) return PLOT.NONE;
    return this.zones[this.index(x, z)];
  }
  canDigAt(x, z) { return this.zoneAt(x, z) > 0; }

  setHighlight(x, z, color = 0xffd24a, visible = true) {
    if (visible && this.inBounds(x, z)) {
      this.highlight.position.set(x, 0, z);
      this.highlight.children[0].material.color.setHex(color);
      this.highlight.visible = true;
    } else {
      this.highlight.visible = false;
    }
  }

  set(x, z, value, meta = null) {
    if (!this.inBounds(x, z)) return false;
    const idx = this.index(x, z);
    const prev = this.cells[idx];
    if (prev === value) {
      if (meta) this.meta.set(idx, { ...(this.meta.get(idx) || {}), ...meta });
      return true;
    }
    this.cells[idx] = value;

    const old = this.objects.get(idx);
    if (old) {
      this.root.remove(old);
      old.traverse?.(o => { o.geometry?.dispose?.(); });
      this.objects.delete(idx);
    }

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

  // Найти случайную свободную клетку участка (для собаки/кристалла).
  randomGrass(rand) {
    for (let i = 0; i < 50; i++) {
      const x = Math.floor(rand() * GRID_SIZE);
      const z = Math.floor(rand() * GRID_SIZE);
      if (this.get(x, z) === CELL.GRASS) return { x, z };
    }
    return { x: 0, z: 0 };
  }

  // Возвращает центр входного участка (например, VIP), куда камера фокусируется в начале.
  getStartFocus() {
    const p = this.plots[0];
    if (!p) return { x: GRID_SIZE / 2, z: GRID_SIZE / 2 };
    return { x: (p.x0 + p.x1) / 2, z: (p.z0 + p.z1) / 2 };
  }
}
