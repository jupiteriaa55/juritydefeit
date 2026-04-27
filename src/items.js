// Каталог объектов (надгробия, цветы, дорожки, декор) и инструментов.
// Каждый объект описан "схемой": цена, стиль, мини-фабрика геометрии.
// Меши строятся из примитивов Three.js — без текстур и тяжёлых ассетов.

import * as THREE from 'three';
import { getTexture } from './textures.js';

export const TOOL = {
  NONE: 'none',
  DIG: 'dig',
  FILL: 'fill',     // зарыть могилу (после похорон)
  NAME: 'name',     // написать имя на надгробии
  REMOVE: 'remove', // снести объект (вернуть 50%)
  CALL_DOG: 'dog',
};

// Идентификаторы клеток. 0 = трава, 1 = выкопанная яма, 2 = засыпанная могила.
// Любой плейсбл объект получает id >= 10.
export const CELL = {
  GRASS: 0,
  PIT: 1,
  FILLED: 2,
};

// Категории для UI.
export const CAT = {
  ACTION: 'action',
  TOMB: 'tomb',
  FLOWER: 'flower',
  PATH: 'path',
  DECO: 'deco',
};

// Палитра «мультяшная»: яркие, насыщенные цвета.
const COL = {
  stoneLight: 0xc8c2b6,
  stoneGrey: 0x8a8b88,
  marble: 0xe7e7ea,
  gold: 0xf0c060,
  black: 0x1c1c1e,
  woodLight: 0xb98a55,
  woodDark: 0x6e4a26,
  iron: 0x4a4f57,
  copper: 0xb86e3a,
  flowerWhite: 0xfaf6e0,
  flowerRed: 0xe85b5b,
  flowerViolet: 0x9a6cd6,
  flowerYellow: 0xffd24a,
  leaf: 0x4f8a3f,
  pine: 0x2f6a3a,
  pinkPath: 0xc8b89a,
  lampGlow: 0xffd47a,
  fenceBlack: 0x202225,
};

const _matCache = new Map();
function mat(color, opts = {}) {
  const key = `${color}|${opts.flat ?? 1}|${opts.shiny ?? 0}|${opts.emissive ?? 0}|${opts.tex ?? ''}`;
  if (_matCache.has(key)) return _matCache.get(key);
  const params = {
    color,
    flatShading: opts.flat ?? true,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissive ? 0.6 : 0,
  };
  if (opts.tex) {
    const t = getTexture(opts.tex);
    if (t) {
      // отдельная клонированная текстура с собственным repeat
      const cloned = t.clone();
      cloned.needsUpdate = true;
      cloned.wrapS = cloned.wrapT = THREE.RepeatWrapping;
      cloned.repeat.set(opts.texRepeat ?? 1, opts.texRepeat ?? 1);
      params.map = cloned;
    }
  }
  const m = new THREE.MeshLambertMaterial(params);
  _matCache.set(key, m);
  return m;
}

function group(...children) {
  const g = new THREE.Group();
  for (const c of children) if (c) g.add(c);
  return g;
}
function box(w, h, d, color, x = 0, y = 0, z = 0, texOpts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), texOpts ? mat(color, texOpts) : mat(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(rTop, rBot, h, color, x = 0, y = 0, z = 0, segments = 8) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segments), mat(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function sphere(r, color, x = 0, y = 0, z = 0, seg = 8) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), mat(color));
  m.position.set(x, y + r, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// Фабрики мешей. Все объекты помещаются в куб 1×?×1 (одна клетка = 1 единица).
const MAKERS = {
  pit() {
    // Выкопанная яма — тёмный прямоугольник + холмик земли рядом.
    const g = new THREE.Group();
    const hole = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.95), mat(0x2a1a10));
    hole.position.y = -0.12; hole.receiveShadow = true; g.add(hole);
    const mound = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.4), mat(0xb87a44, { tex: 'dirt' }));
    mound.position.set(0.55, 0.07, 0); mound.castShadow = true; g.add(mound);
    return g;
  },
  filled() {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.12, 0.95), mat(0xb87a44, { tex: 'dirt' }));
    m.position.y = 0.06; m.castShadow = true; m.receiveShadow = true;
    return m;
  },
  tombSimple() {
    // Простой деревянный крест + холмик.
    const g = new THREE.Group();
    g.add(MAKERS.filled());
    g.add(box(0.08, 0.7, 0.08, 0xc89060, 0, 0.12, -0.25, { tex: 'wood' }));
    g.add(box(0.36, 0.08, 0.08, 0xc89060, 0, 0.55, -0.25, { tex: 'wood' }));
    return g;
  },
  tombStone() {
    // Каменное надгробие.
    const g = new THREE.Group();
    g.add(MAKERS.filled());
    const base = box(0.6, 0.18, 0.22, 0xb8b1a4, 0, 0.12, -0.25, { tex: 'stone' });
    const stone = box(0.5, 0.55, 0.14, 0xd4cec1, 0, 0.30, -0.25, { tex: 'stone' });
    g.add(base); g.add(stone);
    return g;
  },
  tombMarble() {
    const g = new THREE.Group();
    g.add(MAKERS.filled());
    g.add(box(0.7, 0.2, 0.28, 0xc1bbb4, 0, 0.12, -0.22, { tex: 'marble' }));
    g.add(box(0.6, 0.7, 0.18, 0xefedea, 0, 0.32, -0.22, { tex: 'marble' }));
    g.add(box(0.4, 0.1, 0.18, COL.gold, 0, 0.96, -0.22));
    return g;
  },
  tombLuxury() {
    // Мраморный обелиск с золотом и крылатой фигурой.
    const g = new THREE.Group();
    g.add(MAKERS.filled());
    g.add(box(0.85, 0.18, 0.4, 0x9b958e, 0, 0.12, -0.18, { tex: 'stone' }));
    g.add(box(0.7, 0.14, 0.35, 0xefedea, 0, 0.28, -0.18, { tex: 'marble' }));
    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.22, 1.0, 4), mat(0xefedea, { tex: 'marble' }));
    obelisk.position.set(0, 0.92, -0.18); obelisk.castShadow = true; g.add(obelisk);
    g.add(sphere(0.08, COL.gold, 0, 1.43, -0.18));
    // крылья
    g.add(box(0.4, 0.05, 0.06, COL.gold, -0.22, 1.05, -0.18));
    g.add(box(0.4, 0.05, 0.06, COL.gold, 0.22, 1.05, -0.18));
    return g;
  },
  crossWood() {
    const g = new THREE.Group();
    g.add(MAKERS.filled());
    g.add(box(0.08, 0.85, 0.08, 0xc89060, 0, 0.12, -0.25, { tex: 'wood' }));
    g.add(box(0.42, 0.08, 0.08, 0xc89060, 0, 0.7, -0.25, { tex: 'wood' }));
    return g;
  },
  crossIron() {
    const g = new THREE.Group();
    g.add(MAKERS.filled());
    g.add(box(0.08, 0.95, 0.08, COL.iron, 0, 0.12, -0.25));
    g.add(box(0.5, 0.08, 0.08, COL.iron, 0, 0.78, -0.25));
    g.add(sphere(0.08, COL.gold, 0, 1.0, -0.25));
    return g;
  },
  flowerWhite() { return _flower(COL.flowerWhite); },
  flowerRed() { return _flower(COL.flowerRed); },
  flowerViolet() { return _flower(COL.flowerViolet); },
  flowerYellow() { return _flower(COL.flowerYellow); },
  pathStone() {
    const g = new THREE.Group();
    const tile = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.95), mat(0xc8b89a, { tex: 'path' }));
    tile.position.y = 0.03; tile.receiveShadow = true; g.add(tile);
    return g;
  },
  treePine() {
    const g = new THREE.Group();
    g.add(cyl(0.08, 0.12, 0.4, 0x8a5a30, 0, 0, 0));
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.1, 7), mat(0x4a8a3f, { tex: 'leaves' }));
    top.position.y = 0.95; top.castShadow = true; g.add(top);
    return g;
  },
  bench() {
    const g = new THREE.Group();
    g.add(box(0.8, 0.06, 0.25, 0xc89060, 0, 0.18, 0, { tex: 'wood' }));
    g.add(box(0.8, 0.4, 0.05, 0xc89060, 0, 0.24, -0.1, { tex: 'wood' }));
    g.add(box(0.06, 0.18, 0.22, COL.iron, -0.32, 0, 0));
    g.add(box(0.06, 0.18, 0.22, COL.iron, 0.32, 0, 0));
    return g;
  },
  lamp() {
    const g = new THREE.Group();
    g.add(cyl(0.04, 0.08, 0.95, COL.iron, 0, 0));
    const head = box(0.18, 0.18, 0.18, COL.lampGlow, 0, 0.92, 0);
    head.material = mat(COL.lampGlow, { emissive: COL.lampGlow });
    g.add(head);
    return g;
  },
  fence() {
    const g = new THREE.Group();
    g.add(box(0.95, 0.5, 0.04, COL.fenceBlack, 0, 0.05, 0));
    for (let i = -3; i <= 3; i++) g.add(box(0.04, 0.55, 0.04, COL.fenceBlack, i * 0.13, 0, 0));
    return g;
  },
  crystal() {
    // Декоративный кристалл (бонус собаки).
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), mat(0x7adcff, { emissive: 0x224a66 }));
    c.position.y = 0.22; c.castShadow = true; g.add(c);
    return g;
  },
};

function _flower(color) {
  const g = new THREE.Group();
  g.add(box(0.05, 0.18, 0.05, COL.leaf, 0, 0, 0));
  g.add(sphere(0.09, color, 0, 0.15, 0));
  g.add(box(0.05, 0.15, 0.05, COL.leaf, -0.12, 0, 0.06));
  g.add(sphere(0.07, color, -0.12, 0.13, 0.06));
  g.add(box(0.05, 0.16, 0.05, COL.leaf, 0.12, 0, -0.05));
  g.add(sphere(0.08, color, 0.12, 0.13, -0.05));
  return g;
}

export const ITEM_DEFS = {
  // действия (инструменты)
  dig:    { id: 'dig',    cat: CAT.ACTION, name: 'Выкопать',          icon: '⛏', cost: 0,   style: 0, tool: TOOL.DIG },
  fill:   { id: 'fill',   cat: CAT.ACTION, name: 'Засыпать',          icon: '🚛', cost: 0,   style: 0, tool: TOOL.FILL },
  name:   { id: 'name',   cat: CAT.ACTION, name: 'Написать имя',      icon: '✒',  cost: 0,   style: 0, tool: TOOL.NAME },
  remove: { id: 'remove', cat: CAT.ACTION, name: 'Снести',            icon: '🗑', cost: 0,   style: 0, tool: TOOL.REMOVE },
  dog:    { id: 'dog',    cat: CAT.ACTION, name: 'Позвать собаку',    icon: '🐕', cost: 0,   style: 0, tool: TOOL.CALL_DOG },

  // надгробия (требуют засыпанную могилу под ними; fill ставится автоматически)
  tomb_simple:  { id: 'tomb_simple',  cellId: 10, cat: CAT.TOMB, name: 'Деревянный крест',  icon: '✝', cost: 30,  style: 2,  needsFilled: true, maker: 'tombSimple' },
  tomb_stone:   { id: 'tomb_stone',   cellId: 11, cat: CAT.TOMB, name: 'Каменное надгробие',icon: '🪦', cost: 80,  style: 5,  needsFilled: true, maker: 'tombStone' },
  tomb_marble:  { id: 'tomb_marble',  cellId: 12, cat: CAT.TOMB, name: 'Мраморное',         icon: '⛯',  cost: 180, style: 8,  needsFilled: true, maker: 'tombMarble' },
  tomb_luxury:  { id: 'tomb_luxury',  cellId: 13, cat: CAT.TOMB, name: 'Обелиск-люкс',      icon: '🏛', cost: 380, style: 12, needsFilled: true, maker: 'tombLuxury' },
  cross_wood:   { id: 'cross_wood',   cellId: 14, cat: CAT.TOMB, name: 'Крест дубовый',     icon: '✟', cost: 18,  style: 1,  needsFilled: true, maker: 'crossWood' },
  cross_iron:   { id: 'cross_iron',   cellId: 15, cat: CAT.TOMB, name: 'Крест кованый',     icon: '☩', cost: 60,  style: 4,  needsFilled: true, maker: 'crossIron' },

  // цветы (рядом с могилой = бонус)
  flower_white:  { id: 'flower_white',  cellId: 20, cat: CAT.FLOWER, name: 'Белые цветы',  icon: '🌼', cost: 8,  style: 1, maker: 'flowerWhite' },
  flower_red:    { id: 'flower_red',    cellId: 21, cat: CAT.FLOWER, name: 'Красные розы', icon: '🌹', cost: 14, style: 2, maker: 'flowerRed' },
  flower_violet: { id: 'flower_violet', cellId: 22, cat: CAT.FLOWER, name: 'Фиалки',       icon: '💜', cost: 22, style: 3, maker: 'flowerViolet' },
  flower_yellow: { id: 'flower_yellow', cellId: 23, cat: CAT.FLOWER, name: 'Жёлтые',       icon: '🌻', cost: 12, style: 2, maker: 'flowerYellow' },

  // дорожки
  path_stone:   { id: 'path_stone', cellId: 30, cat: CAT.PATH, name: 'Дорожка',  icon: '▦', cost: 5, style: 0, maker: 'pathStone' },

  // декор
  tree_pine:  { id: 'tree_pine',  cellId: 40, cat: CAT.DECO, name: 'Сосна',     icon: '🌲', cost: 25, style: 1, maker: 'treePine' },
  bench:      { id: 'bench',      cellId: 41, cat: CAT.DECO, name: 'Скамья',    icon: '🪑', cost: 40, style: 2, maker: 'bench' },
  lamp:       { id: 'lamp',       cellId: 42, cat: CAT.DECO, name: 'Фонарь',    icon: '🕯', cost: 60, style: 3, maker: 'lamp' },
  fence:      { id: 'fence',      cellId: 43, cat: CAT.DECO, name: 'Ограда',    icon: '🚧', cost: 10, style: 1, maker: 'fence' },

  // кристалл (нельзя купить — даёт собака)
  crystal:    { id: 'crystal',    cellId: 50, cat: CAT.DECO, name: 'Кристалл',  icon: '💎', cost: 0, style: 4, maker: 'crystal', notBuyable: true },
};

// Поиск определения по cellId.
const _byCellId = new Map();
for (const k in ITEM_DEFS) {
  const d = ITEM_DEFS[k];
  if (d.cellId != null) _byCellId.set(d.cellId, d);
}
export function defByCellId(id) { return _byCellId.get(id); }

// Список инструментов в порядке отображения в UI.
export const TOOLBAR_ORDER = [
  'dig', 'fill', 'name', 'remove', 'dog',
  'tomb_simple', 'tomb_stone', 'tomb_marble', 'tomb_luxury',
  'cross_wood', 'cross_iron',
  'flower_white', 'flower_yellow', 'flower_red', 'flower_violet',
  'path_stone',
  'tree_pine', 'bench', 'lamp', 'fence',
];

// Создаёт визуальный меш по item id (cellId).
export function buildItemMesh(itemId) {
  const def = ITEM_DEFS[itemId];
  if (!def || !def.maker) return null;
  return MAKERS[def.maker]();
}

// Меши «состояний» клеток: pit и filled (не покупаются, у инструментов нет maker).
export function buildPitMesh() { return MAKERS.pit(); }
export function buildFilledMesh() { return MAKERS.filled(); }

// Бонус за наличие соседних дорожек/цветов.
export function neighborBonus(cellGet, x, z) {
  let bonus = 0;
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const c = cellGet(x + dx, z + dz);
    if (c == null) continue;
    if (c === 30) bonus += 1; // path
    if (c >= 20 && c < 30) bonus += 0.5; // flower
  }
  return bonus;
}
