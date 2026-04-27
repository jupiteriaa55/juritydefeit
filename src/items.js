// Каталог объектов (надгробия, цветы, дорожки, декор) и инструментов.
// Меши строятся из примитивов с применением процедурных мультяшных текстур.

import * as THREE from 'three';
import { getTexture } from './textures.js';

export const TOOL = {
  NONE: 'none',
  DIG: 'dig',
  FILL: 'fill',
  NAME: 'name',
  REMOVE: 'remove',
  CALL_DOG: 'dog',
};

// Идентификаторы клеток. 0 = трава, 1 = выкопанная яма, 2 = засыпанная могила.
// Любой плейсбл объект получает id >= 10.
export const CELL = {
  GRASS: 0,
  PIT: 1,
  FILLED: 2,
};

// Категории для UI — табы.
export const CAT = {
  ACTION: 'action',
  TOMB: 'tomb',
  CROSS: 'cross',
  FLOWER: 'flower',
  PATH: 'path',
  DECO: 'deco',
  NATURE: 'nature',
};

// Палитра.
const COL = {
  stoneLight: 0xd2cdc1,
  stoneGrey: 0x8a8b88,
  marble: 0xefede9,
  gold: 0xe6b240,
  black: 0x1c1c1e,
  woodLight: 0xb98a55,
  woodDark: 0x6e4a26,
  iron: 0x4a4f57,
  copper: 0xb86e3a,
  flowerWhite: 0xfaf6e0,
  flowerRed: 0xe85b5b,
  flowerViolet: 0x9a6cd6,
  flowerYellow: 0xffd24a,
  flowerLavender: 0xc8a7f2,
  flowerLily: 0xfff5e6,
  leaf: 0x4f8a3f,
  pine: 0x2f6a3a,
  oak: 0x4a8542,
  pinkPath: 0xc8b89a,
  lampGlow: 0xffd47a,
  fenceBlack: 0x202225,
};

const _matCache = new Map();
function mat(color, opts = {}) {
  const key = `${color}|${opts.flat ?? 1}|${opts.shiny ?? 0}|${opts.emissive ?? 0}|${opts.tex ?? ''}|${opts.texRepeat ?? ''}`;
  if (_matCache.has(key)) return _matCache.get(key);
  const params = {
    color,
    flatShading: opts.flat ?? true,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissive ? (opts.emissiveIntensity ?? 0.6) : 0,
  };
  if (opts.tex) {
    const t = getTexture(opts.tex);
    if (t) {
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

function box(w, h, d, color, x = 0, y = 0, z = 0, texOpts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), texOpts ? mat(color, texOpts) : mat(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(rTop, rBot, h, color, x = 0, y = 0, z = 0, segments = 10, texOpts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segments), texOpts ? mat(color, texOpts) : mat(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function sphere(r, color, x = 0, y = 0, z = 0, seg = 10, texOpts) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, seg), texOpts ? mat(color, texOpts) : mat(color));
  m.position.set(x, y + r, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cone(r, h, color, x = 0, y = 0, z = 0, seg = 10, texOpts) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), texOpts ? mat(color, texOpts) : mat(color));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---------- Фабрики (все объекты помещаются в куб 1×?×1, кроме крупных) ----------
const MAKERS = {
  pit() {
    const g = new THREE.Group();
    const hole = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.28, 0.95), mat(0x231308));
    hole.position.y = -0.13; hole.receiveShadow = true; g.add(hole);
    const mound = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.42), mat(0xb47636, { tex: 'dirt' }));
    mound.position.set(0.55, 0.09, 0); mound.castShadow = true; g.add(mound);
    // Лопата воткнутая.
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), mat(0x8a5a30, { tex: 'wood' }));
    handle.position.set(-0.32, 0.32, 0.1); handle.rotation.z = 0.4;
    handle.castShadow = true; g.add(handle);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.04), mat(0x6e7480, { tex: 'iron' }));
    head.position.set(-0.45, 0.6, 0.1); head.rotation.z = 0.4;
    head.castShadow = true; g.add(head);
    return g;
  },
  filled() {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.18, 0.95), mat(0xb47636, { tex: 'dirt' }));
    m.position.y = 0.09; m.castShadow = true; m.receiveShadow = true; g.add(m);
    return g;
  },

  // ---------- НАДГРОБИЯ ----------
  tombSimple() {
    const g = new THREE.Group();
    g.add(MAKERS.filled());
    g.add(box(0.10, 0.7, 0.10, 0xc89060, 0, 0.18, -0.25, { tex: 'wood' }));
    g.add(box(0.40, 0.10, 0.10, 0xc89060, 0, 0.6, -0.25, { tex: 'wood' }));
    return g;
  },
  tombStone() {
    const g = new THREE.Group();
    g.add(MAKERS.filled());
    g.add(box(0.65, 0.18, 0.25, 0xb8b1a4, 0, 0.18, -0.25, { tex: 'stone' }));
    // Каменное надгробие с верхним «куполом».
    const stone = box(0.5, 0.55, 0.16, 0xd4cec1, 0, 0.36, -0.25, { tex: 'stone' });
    g.add(stone);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.18, 16, 1, false, 0, Math.PI), mat(0xd4cec1, { tex: 'stone' }));
    top.rotation.y = Math.PI / 2;
    top.rotation.x = Math.PI / 2;
    top.position.set(0, 0.91, -0.17); top.castShadow = true;
    g.add(top);
    return g;
  },
  tombMarble() {
    const g = new THREE.Group();
    g.add(MAKERS.filled());
    g.add(box(0.75, 0.22, 0.32, 0xc1bbb4, 0, 0.18, -0.22, { tex: 'marble' }));
    g.add(box(0.62, 0.74, 0.20, 0xefede9, 0, 0.4, -0.22, { tex: 'marble' }));
    // золотая «корона»
    g.add(box(0.45, 0.10, 0.20, COL.gold, 0, 1.10, -0.22, { tex: 'gold' }));
    g.add(box(0.18, 0.04, 0.04, COL.gold, 0, 1.20, -0.22, { tex: 'gold' }));
    return g;
  },
  tombLuxury() {
    // Богатый памятник: пьедестал + обелиск + золото + ангел.
    const g = new THREE.Group();
    g.add(MAKERS.filled());
    g.add(box(0.95, 0.22, 0.55, 0x9c958a, 0, 0.18, -0.18, { tex: 'stone' }));
    g.add(box(0.78, 0.18, 0.45, 0xefede9, 0, 0.4, -0.18, { tex: 'marble' }));
    const obelisk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.24, 1.2, 4), mat(0xefede9, { tex: 'marble' }));
    obelisk.position.set(0, 1.15, -0.18); obelisk.castShadow = true; g.add(obelisk);
    g.add(sphere(0.10, COL.gold, 0, 1.78, -0.18, 12, { tex: 'gold' }));
    // Маленькая фигурка ангела.
    g.add(sphere(0.08, 0xefe6cf, 0, 0.65, -0.18));
    g.add(box(0.22, 0.04, 0.06, 0xefede9, -0.12, 0.78, -0.18, { tex: 'marble' }));
    g.add(box(0.22, 0.04, 0.06, 0xefede9, 0.12, 0.78, -0.18, { tex: 'marble' }));
    return g;
  },
  tombSarcophagus() {
    // Саркофаг с золотом — самый дорогой.
    const g = new THREE.Group();
    g.add(MAKERS.filled());
    g.add(box(0.95, 0.30, 0.55, 0xd4cec1, 0, 0.18, 0, { tex: 'marble' }));
    g.add(box(0.85, 0.18, 0.48, 0xefede9, 0, 0.50, 0, { tex: 'marble' }));
    // золотая крышка с узором
    g.add(box(0.85, 0.10, 0.48, COL.gold, 0, 0.66, 0, { tex: 'gold' }));
    // Углы
    for (const dx of [-0.34, 0.34]) for (const dz of [-0.18, 0.18]) {
      g.add(sphere(0.07, COL.gold, dx, 0.56, dz, 10, { tex: 'gold' }));
    }
    return g;
  },
  crossWood() {
    const g = new THREE.Group();
    g.add(MAKERS.filled());
    g.add(box(0.10, 0.95, 0.10, 0xc89060, 0, 0.18, -0.25, { tex: 'wood' }));
    g.add(box(0.50, 0.10, 0.10, 0xc89060, 0, 0.85, -0.25, { tex: 'wood' }));
    return g;
  },
  crossIron() {
    const g = new THREE.Group();
    g.add(MAKERS.filled());
    g.add(box(0.08, 1.05, 0.08, 0x6c7280, 0, 0.18, -0.25, { tex: 'iron' }));
    g.add(box(0.55, 0.08, 0.08, 0x6c7280, 0, 0.92, -0.25, { tex: 'iron' }));
    g.add(sphere(0.08, COL.gold, 0, 1.20, -0.25, 12, { tex: 'gold' }));
    return g;
  },
  crossOrthodox() {
    // Православный «трёхпрекладинный» крест.
    const g = new THREE.Group();
    g.add(MAKERS.filled());
    g.add(box(0.08, 1.15, 0.08, COL.iron, 0, 0.18, -0.25, { tex: 'iron' }));
    g.add(box(0.36, 0.08, 0.08, COL.iron, 0, 0.92, -0.25, { tex: 'iron' }));
    g.add(box(0.50, 0.08, 0.08, COL.iron, 0, 1.05, -0.25, { tex: 'iron' }));
    const tilted = box(0.40, 0.08, 0.08, COL.iron, 0, 0.65, -0.25, { tex: 'iron' });
    tilted.rotation.z = -0.25; g.add(tilted);
    g.add(sphere(0.08, COL.gold, 0, 1.32, -0.25, 12, { tex: 'gold' }));
    return g;
  },

  // ---------- ЦВЕТЫ ----------
  flowerWhite() { return _flower(0xfaf6e0, 0xffd24a); },
  flowerRed() { return _flower(0xe85b5b, 0xfff3a8); },
  flowerViolet() { return _flower(0x9a6cd6, 0xffe680); },
  flowerYellow() { return _flower(0xffd24a, 0xffffff); },
  flowerLavender() { return _flowerStalks(0xc8a7f2); },
  flowerTulip() { return _flowerTulip(0xff7a7a); },
  flowerLily() { return _flowerLily(0xfff5e6); },
  rose() { return _flowerRose(0xb8264a); },

  // ---------- ДОРОЖКИ ----------
  pathStone() {
    // Светлая плитка «в шахматку» — как в оригинале Алавар 2010 г.
    const g = new THREE.Group();
    const tile = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 0.96), mat(0xd8d2c0, { tex: 'path' }));
    tile.position.y = 0.04; tile.receiveShadow = true; g.add(tile);
    return g;
  },
  pathBrick() {
    const g = new THREE.Group();
    const tile = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 0.96), mat(0xb05a2c));
    tile.position.y = 0.04; tile.receiveShadow = true; g.add(tile);
    // Линии «кирпичей»
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.005, 0.04), mat(0x442213));
    line.position.y = 0.071; g.add(line);
    return g;
  },
  pathMarble() {
    const g = new THREE.Group();
    const tile = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.06, 0.96), mat(0xefede9, { tex: 'marble' }));
    tile.position.y = 0.04; tile.receiveShadow = true; g.add(tile);
    return g;
  },

  // ---------- ДЕКОР ----------
  treePine() {
    const g = new THREE.Group();
    g.add(cyl(0.10, 0.16, 0.55, 0x8a5a30, 0, 0, 0, 8, { tex: 'wood' }));
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.4, 8), mat(0x4a8a3f, { tex: 'leaves' }));
    top.position.y = 1.18; top.castShadow = true; g.add(top);
    return g;
  },
  treeOak() {
    const g = new THREE.Group();
    g.add(cyl(0.18, 0.24, 0.95, 0x8a5a30, 0, 0, 0, 10, { tex: 'wood' }));
    g.add(sphere(0.6, 0x6ba34f, 0, 1.0, 0, 12, { tex: 'leaves' }));
    g.add(sphere(0.45, 0x4f8a3a, -0.35, 1.15, 0.25, 12, { tex: 'leaves' }));
    g.add(sphere(0.45, 0x6ba34f, 0.35, 1.15, -0.25, 12, { tex: 'leaves' }));
    return g;
  },
  shrub() {
    const g = new THREE.Group();
    g.add(sphere(0.30, 0x4f8a3a, -0.10, 0.04, 0, 10, { tex: 'leaves' }));
    g.add(sphere(0.25, 0x6ba34f, 0.15, 0.08, 0.10, 10, { tex: 'leaves' }));
    g.add(sphere(0.20, 0x4f8a3a, 0.05, 0.16, -0.15, 10, { tex: 'leaves' }));
    return g;
  },
  // Сакура / цветущее дерево — главный визуальный элемент оригинала «Весёлый Могильщик».
  treeSakura() {
    const g = new THREE.Group();
    g.add(cyl(0.16, 0.22, 0.85, 0x6c4022, 0, 0, 0, 10, { tex: 'wood' }));
    // Розовые «облака» цветущей кроны
    const pink1 = 0xff9ec7;
    const pink2 = 0xff7fb3;
    const pink3 = 0xffb6d3;
    g.add(sphere(0.62, pink1, 0,    1.05, 0,    14));
    g.add(sphere(0.50, pink2, -0.42, 1.20, 0.18, 14));
    g.add(sphere(0.50, pink3, 0.42,  1.20, -0.18, 14));
    g.add(sphere(0.42, pink1, 0,    1.50, 0,    14));
    g.add(sphere(0.36, pink2, 0.30, 1.45, 0.30, 12));
    g.add(sphere(0.36, pink3, -0.30, 1.45, -0.30, 12));
    return g;
  },
  // Пруд: голубой плоский диск с тёмным «кантом» (вода).
  pond() {
    const g = new THREE.Group();
    // Основа — темнее (вода глубже)
    const base = new THREE.Mesh(new THREE.CircleGeometry(0.55, 18), mat(0x2c6e8f));
    base.rotation.x = -Math.PI / 2;
    base.position.y = 0.02;
    base.receiveShadow = true;
    g.add(base);
    // Светлый блик сверху
    const highlight = new THREE.Mesh(new THREE.CircleGeometry(0.42, 18), mat(0x4ea0c8));
    highlight.rotation.x = -Math.PI / 2;
    highlight.position.y = 0.025;
    g.add(highlight);
    // Маленький белый блик
    const sparkle = new THREE.Mesh(new THREE.CircleGeometry(0.10, 12), mat(0xffffff));
    sparkle.rotation.x = -Math.PI / 2;
    sparkle.position.set(-0.18, 0.03, -0.10);
    g.add(sparkle);
    return g;
  },
  bench() {
    const g = new THREE.Group();
    g.add(box(0.85, 0.07, 0.28, 0xc89060, 0, 0.20, 0, { tex: 'wood' }));
    g.add(box(0.85, 0.45, 0.06, 0xc89060, 0, 0.27, -0.11, { tex: 'wood' }));
    g.add(box(0.07, 0.20, 0.25, 0x6c7280, -0.36, 0, 0, { tex: 'iron' }));
    g.add(box(0.07, 0.20, 0.25, 0x6c7280, 0.36, 0, 0, { tex: 'iron' }));
    return g;
  },
  benchGold() {
    const g = new THREE.Group();
    g.add(box(0.85, 0.07, 0.28, 0xefede9, 0, 0.20, 0, { tex: 'marble' }));
    g.add(box(0.85, 0.45, 0.06, 0xefede9, 0, 0.27, -0.11, { tex: 'marble' }));
    g.add(box(0.07, 0.20, 0.25, COL.gold, -0.36, 0, 0, { tex: 'gold' }));
    g.add(box(0.07, 0.20, 0.25, COL.gold, 0.36, 0, 0, { tex: 'gold' }));
    return g;
  },
  lamp() {
    const g = new THREE.Group();
    g.add(cyl(0.04, 0.10, 1.20, 0x4a4f57, 0, 0, 0, 8, { tex: 'iron' }));
    const head = box(0.22, 0.22, 0.22, 0xffd47a, 0, 1.16, 0);
    head.material = mat(0xffd47a, { emissive: 0xffae33, emissiveIntensity: 0.8 });
    g.add(head);
    // Каркас «фонаря»
    g.add(box(0.04, 0.22, 0.04, COL.gold, -0.12, 1.16, -0.12, { tex: 'gold' }));
    g.add(box(0.04, 0.22, 0.04, COL.gold, 0.12, 1.16, -0.12, { tex: 'gold' }));
    g.add(box(0.04, 0.22, 0.04, COL.gold, -0.12, 1.16, 0.12, { tex: 'gold' }));
    g.add(box(0.04, 0.22, 0.04, COL.gold, 0.12, 1.16, 0.12, { tex: 'gold' }));
    g.add(box(0.30, 0.04, 0.30, COL.gold, 0, 1.30, 0, { tex: 'gold' }));
    g.add(cone(0.20, 0.18, COL.gold, 0, 1.34, 0, 8, { tex: 'gold' }));
    return g;
  },
  candle() {
    const g = new THREE.Group();
    g.add(cyl(0.10, 0.10, 0.06, 0x4a4f57, 0, 0, 0, 16, { tex: 'iron' }));
    g.add(cyl(0.06, 0.06, 0.16, 0xfff3a8, 0, 0.06, 0));
    const flame = sphere(0.04, 0xffae33);
    flame.material = mat(0xffae33, { emissive: 0xffae33, emissiveIntensity: 1.0 });
    flame.position.y = 0.30;
    g.add(flame);
    return g;
  },
  wreath() {
    // Венок — кольцо листьев с лентой.
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.07, 8, 18), mat(0x4f8a3a, { tex: 'leaves' }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.15; ring.castShadow = true; g.add(ring);
    // ленты
    g.add(box(0.06, 0.18, 0.02, 0xb8264a, 0, 0.04, 0));
    g.add(box(0.06, 0.18, 0.02, 0xb8264a, 0.10, 0.04, 0.05));
    // несколько цветков
    g.add(sphere(0.05, 0xfff3a8, 0.18, 0.18, 0));
    g.add(sphere(0.05, 0xb8264a, -0.18, 0.18, 0));
    g.add(sphere(0.05, 0xefede9, 0, 0.18, 0.20));
    return g;
  },
  fence() {
    const g = new THREE.Group();
    g.add(box(0.96, 0.50, 0.04, 0x202225, 0, 0.05, 0, { tex: 'iron' }));
    for (let i = -3; i <= 3; i++) {
      g.add(box(0.04, 0.55, 0.04, 0x202225, i * 0.13, 0, 0, { tex: 'iron' }));
    }
    // декоративные «шипы» сверху
    for (let i = -3; i <= 3; i++) {
      g.add(cone(0.04, 0.12, COL.gold, i * 0.13, 0.55, 0, 6, { tex: 'gold' }));
    }
    return g;
  },
  fenceStone() {
    const g = new THREE.Group();
    g.add(box(0.96, 0.40, 0.20, 0xb8b1a4, 0, 0.05, 0, { tex: 'stone' }));
    g.add(box(0.96, 0.10, 0.26, 0x8a8580, 0, 0.45, 0, { tex: 'stone' }));
    return g;
  },
  angel() {
    // Скульптура ангела (~1 клетка).
    const g = new THREE.Group();
    g.add(MAKERS.filled());
    g.add(box(0.55, 0.18, 0.45, 0x9c958a, 0, 0.18, 0, { tex: 'stone' }));
    // тело
    g.add(box(0.30, 0.55, 0.22, 0xefede9, 0, 0.36, 0, { tex: 'marble' }));
    // голова
    g.add(sphere(0.14, 0xefede9, 0, 0.92, 0, 14, { tex: 'marble' }));
    // нимб
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 18), mat(COL.gold, { tex: 'gold' }));
    halo.rotation.x = Math.PI / 2; halo.position.set(0, 1.15, 0); g.add(halo);
    // крылья
    const wL = box(0.46, 0.10, 0.06, 0xefede9, -0.30, 0.7, -0.05, { tex: 'marble' });
    wL.rotation.z = 0.4; g.add(wL);
    const wR = box(0.46, 0.10, 0.06, 0xefede9, 0.30, 0.7, -0.05, { tex: 'marble' });
    wR.rotation.z = -0.4; g.add(wR);
    return g;
  },
  mausoleum() {
    // Большой склеп — занимает 2×2 клетки (визуально).
    const g = new THREE.Group();
    // подиум
    g.add(box(2.0, 0.18, 2.0, 0xb8b1a4, 0.5, 0.05, 0.5, { tex: 'stone' }));
    // стены
    g.add(box(1.6, 1.4, 1.6, 0xefede9, 0.5, 0.18, 0.5, { tex: 'marble' }));
    // фронтон
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.7, 4), mat(0x9c958a, { tex: 'stone' }));
    roof.position.set(0.5, 1.92, 0.5);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true; g.add(roof);
    // дверь
    g.add(box(0.5, 0.9, 0.04, 0x6c4a26, 0.5, 0.18, 1.30, { tex: 'wood' }));
    // золотой герб
    g.add(sphere(0.10, COL.gold, 0.5, 1.20, 1.30, 12, { tex: 'gold' }));
    // колонны
    for (const dx of [-0.6, 0.6]) for (const dz of [-0.6, 0.6]) {
      g.add(cyl(0.10, 0.10, 1.4, 0xefede9, 0.5 + dx, 0.18, 0.5 + dz, 12, { tex: 'marble' }));
    }
    return g;
  },
  chapel() {
    // Часовня — занимает 3×3 клетки (визуально).
    const g = new THREE.Group();
    g.add(box(3.0, 0.20, 3.0, 0xb8b1a4, 1, 0.06, 1, { tex: 'stone' }));
    g.add(box(2.4, 1.8, 2.4, 0xd2cdc1, 1, 0.20, 1, { tex: 'stone' }));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.2, 4), mat(0xb05a2c));
    roof.position.set(1, 2.6, 1); roof.rotation.y = Math.PI / 4;
    roof.castShadow = true; g.add(roof);
    // башенка
    g.add(cyl(0.15, 0.15, 0.7, 0xd2cdc1, 1, 3.2, 1, 8, { tex: 'stone' }));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 8), mat(COL.gold, { tex: 'gold' }));
    tip.position.set(1, 4.2, 1); tip.castShadow = true; g.add(tip);
    // золотой крест на крыше
    g.add(box(0.06, 0.4, 0.06, COL.gold, 1, 4.5, 1, { tex: 'gold' }));
    g.add(box(0.22, 0.06, 0.06, COL.gold, 1, 4.7, 1, { tex: 'gold' }));
    // вход
    g.add(box(0.7, 1.2, 0.08, 0x6c4a26, 1, 0.20, 2.16, { tex: 'wood' }));
    return g;
  },

  crystal() {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), mat(0x7adcff, { emissive: 0x224a66, emissiveIntensity: 0.8 }));
    c.position.y = 0.28; c.castShadow = true; g.add(c);
    // мелкие осколки
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const small = new THREE.Mesh(new THREE.OctahedronGeometry(0.07), mat(0x7adcff, { emissive: 0x224a66, emissiveIntensity: 0.6 }));
      small.position.set(Math.cos(a) * 0.22, 0.07, Math.sin(a) * 0.22);
      small.castShadow = true; g.add(small);
    }
    return g;
  },
};

function _flower(petalColor, centerColor) {
  const g = new THREE.Group();
  // стебель
  g.add(box(0.04, 0.20, 0.04, 0x4a8a3f, 0, 0, 0));
  // листочки
  g.add(box(0.10, 0.04, 0.04, 0x4a8a3f, 0.06, 0.10, 0));
  g.add(box(0.04, 0.04, 0.10, 0x4a8a3f, 0, 0.14, 0.06));
  // цветок
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const p = sphere(0.06, petalColor, Math.cos(a) * 0.07, 0.20, Math.sin(a) * 0.07);
    g.add(p);
  }
  g.add(sphere(0.05, centerColor, 0, 0.22, 0));
  return g;
}
function _flowerStalks(color) {
  // Лаванда — три стебелька.
  const g = new THREE.Group();
  for (const dx of [-0.10, 0.0, 0.10]) {
    g.add(box(0.03, 0.32, 0.03, 0x4a8a3f, dx, 0, 0));
    for (let i = 0; i < 4; i++) {
      g.add(sphere(0.04, color, dx, 0.20 + i * 0.04, 0));
    }
  }
  return g;
}
function _flowerTulip(color) {
  const g = new THREE.Group();
  g.add(box(0.04, 0.30, 0.04, 0x4a8a3f, 0, 0, 0));
  g.add(box(0.16, 0.02, 0.04, 0x4a8a3f, 0.04, 0.10, 0));
  // бутон
  const bud = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.10, 0.18, 12), mat(color));
  bud.position.y = 0.39; bud.castShadow = true; g.add(bud);
  g.add(cone(0.05, 0.06, color, 0, 0.48, 0, 12));
  return g;
}
function _flowerLily(color) {
  const g = new THREE.Group();
  g.add(box(0.04, 0.32, 0.04, 0x4a8a3f, 0, 0, 0));
  // лепестки лилии — длинные эллипсоиды
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), mat(color));
    p.scale.set(0.5, 1.4, 0.7);
    p.position.set(Math.cos(a) * 0.07, 0.34, Math.sin(a) * 0.07);
    g.add(p);
  }
  g.add(sphere(0.04, 0xffd24a, 0, 0.36, 0));
  return g;
}
function _flowerRose(color) {
  const g = new THREE.Group();
  g.add(box(0.04, 0.26, 0.04, 0x355a2a, 0, 0, 0));
  g.add(box(0.10, 0.04, 0.04, 0x4a8a3f, 0.05, 0.14, 0));
  // несколько вложенных слоёв «бутона»
  for (let i = 0; i < 4; i++) {
    const r = 0.10 - i * 0.02;
    const s = sphere(r, color, 0, 0.28 - i * 0.005, 0);
    g.add(s);
  }
  return g;
}

export const ITEM_DEFS = {
  // действия (инструменты)
  dig:    { id: 'dig',    cat: CAT.ACTION, name: 'Выкопать',          icon: '⛏', cost: 0,   style: 0, tool: TOOL.DIG },
  fill:   { id: 'fill',   cat: CAT.ACTION, name: 'Засыпать',          icon: '🚛', cost: 0,   style: 0, tool: TOOL.FILL },
  name:   { id: 'name',   cat: CAT.ACTION, name: 'Написать имя',      icon: '✒', cost: 0,   style: 0, tool: TOOL.NAME },
  remove: { id: 'remove', cat: CAT.ACTION, name: 'Снести',            icon: '🗑', cost: 0,   style: 0, tool: TOOL.REMOVE },
  dog:    { id: 'dog',    cat: CAT.ACTION, name: 'Позвать собаку',    icon: '🐕', cost: 0,   style: 0, tool: TOOL.CALL_DOG },

  // надгробия
  cross_wood:        { id: 'cross_wood',        cellId: 14, cat: CAT.CROSS, name: 'Крест дубовый',      icon: '✟',  cost: 18,  style: 1,  needsFilled: true, maker: 'crossWood' },
  cross_iron:        { id: 'cross_iron',        cellId: 15, cat: CAT.CROSS, name: 'Крест кованый',      icon: '☩',  cost: 60,  style: 4,  needsFilled: true, maker: 'crossIron' },
  cross_orthodox:    { id: 'cross_orthodox',    cellId: 16, cat: CAT.CROSS, name: 'Православный крест', icon: '☦',  cost: 90,  style: 5,  needsFilled: true, maker: 'crossOrthodox' },

  tomb_simple:       { id: 'tomb_simple',       cellId: 10, cat: CAT.TOMB,  name: 'Простой памятник',   icon: '✝',  cost: 30,  style: 2,  needsFilled: true, maker: 'tombSimple' },
  tomb_stone:        { id: 'tomb_stone',        cellId: 11, cat: CAT.TOMB,  name: 'Каменный',           icon: '🪦', cost: 80,  style: 5,  needsFilled: true, maker: 'tombStone' },
  tomb_marble:       { id: 'tomb_marble',       cellId: 12, cat: CAT.TOMB,  name: 'Мраморный',          icon: '⛯',  cost: 180, style: 8,  needsFilled: true, maker: 'tombMarble' },
  tomb_luxury:       { id: 'tomb_luxury',       cellId: 13, cat: CAT.TOMB,  name: 'Обелиск-люкс',       icon: '🏛',  cost: 380, style: 12, needsFilled: true, maker: 'tombLuxury' },
  tomb_sarcophagus:  { id: 'tomb_sarcophagus',  cellId: 17, cat: CAT.TOMB,  name: 'Саркофаг',           icon: '👑', cost: 620, style: 18, needsFilled: true, maker: 'tombSarcophagus' },

  // цветы
  flower_white:    { id: 'flower_white',    cellId: 20, cat: CAT.FLOWER, name: 'Белые цветы',  icon: '🌼', cost: 8,  style: 1, maker: 'flowerWhite' },
  flower_yellow:   { id: 'flower_yellow',   cellId: 23, cat: CAT.FLOWER, name: 'Жёлтые',       icon: '🌻', cost: 12, style: 2, maker: 'flowerYellow' },
  flower_red:      { id: 'flower_red',      cellId: 21, cat: CAT.FLOWER, name: 'Красные',      icon: '🌹', cost: 14, style: 2, maker: 'flowerRed' },
  flower_violet:   { id: 'flower_violet',   cellId: 22, cat: CAT.FLOWER, name: 'Фиалки',       icon: '💜', cost: 22, style: 3, maker: 'flowerViolet' },
  flower_lavender: { id: 'flower_lavender', cellId: 24, cat: CAT.FLOWER, name: 'Лаванда',      icon: '🌿', cost: 18, style: 2, maker: 'flowerLavender' },
  flower_tulip:    { id: 'flower_tulip',    cellId: 25, cat: CAT.FLOWER, name: 'Тюльпан',      icon: '🌷', cost: 16, style: 2, maker: 'flowerTulip' },
  flower_lily:     { id: 'flower_lily',     cellId: 26, cat: CAT.FLOWER, name: 'Лилия',        icon: '⚜', cost: 24, style: 3, maker: 'flowerLily' },
  flower_rose:     { id: 'flower_rose',     cellId: 27, cat: CAT.FLOWER, name: 'Розы',         icon: '🌹', cost: 30, style: 4, maker: 'rose' },

  // дорожки
  path_stone:    { id: 'path_stone',  cellId: 30, cat: CAT.PATH, name: 'Каменная',  icon: '▦', cost: 5,  style: 0, maker: 'pathStone' },
  path_brick:    { id: 'path_brick',  cellId: 31, cat: CAT.PATH, name: 'Кирпичная', icon: '🧱', cost: 8,  style: 1, maker: 'pathBrick' },
  path_marble:   { id: 'path_marble', cellId: 32, cat: CAT.PATH, name: 'Мраморная', icon: '◇', cost: 18, style: 2, maker: 'pathMarble' },

  // декор
  bench:        { id: 'bench',        cellId: 41, cat: CAT.DECO, name: 'Скамья',     icon: '🪑', cost: 40,  style: 2, maker: 'bench' },
  bench_gold:   { id: 'bench_gold',   cellId: 42, cat: CAT.DECO, name: 'Скамья люкс',icon: '💺', cost: 120, style: 5, maker: 'benchGold' },
  lamp:         { id: 'lamp',         cellId: 43, cat: CAT.DECO, name: 'Фонарь',     icon: '🕯', cost: 60,  style: 3, maker: 'lamp' },
  candle:       { id: 'candle',       cellId: 44, cat: CAT.DECO, name: 'Свеча',      icon: '🔥', cost: 5,   style: 1, maker: 'candle' },
  wreath:       { id: 'wreath',       cellId: 45, cat: CAT.DECO, name: 'Венок',      icon: '🎗', cost: 25,  style: 2, maker: 'wreath' },
  fence:        { id: 'fence',        cellId: 46, cat: CAT.DECO, name: 'Кованая ограда', icon: '🚧', cost: 12, style: 1, maker: 'fence' },
  fence_stone:  { id: 'fence_stone',  cellId: 47, cat: CAT.DECO, name: 'Каменная ограда', icon: '🧱', cost: 22, style: 2, maker: 'fenceStone' },
  angel:        { id: 'angel',        cellId: 48, cat: CAT.DECO, name: 'Ангел',      icon: '👼', cost: 200, style: 7, needsFilled: false, maker: 'angel' },
  mausoleum:    { id: 'mausoleum',    cellId: 49, cat: CAT.DECO, name: 'Склеп (2×2)', icon: '🏛', cost: 800, style: 22, multi: 2, maker: 'mausoleum' },
  chapel:       { id: 'chapel',       cellId: 51, cat: CAT.DECO, name: 'Часовня (3×3)', icon: '⛪', cost: 1500, style: 35, multi: 3, maker: 'chapel' },

  // природа
  tree_sakura:{ id: 'tree_sakura',cellId: 63, cat: CAT.NATURE, name: 'Сакура',     icon: '🌸', cost: 80,  style: 4, maker: 'treeSakura' },
  tree_pine:  { id: 'tree_pine',  cellId: 60, cat: CAT.NATURE, name: 'Сосна',      icon: '🌲', cost: 25,  style: 1, maker: 'treePine' },
  tree_oak:   { id: 'tree_oak',   cellId: 61, cat: CAT.NATURE, name: 'Дуб',        icon: '🌳', cost: 60,  style: 3, maker: 'treeOak' },
  shrub:      { id: 'shrub',      cellId: 62, cat: CAT.NATURE, name: 'Куст',       icon: '🌿', cost: 14,  style: 1, maker: 'shrub' },
  pond:       { id: 'pond',       cellId: 64, cat: CAT.NATURE, name: 'Пруд',       icon: '💧', cost: 50,  style: 3, maker: 'pond' },

  // кристалл (нельзя купить — даёт собака)
  crystal:    { id: 'crystal',    cellId: 50, cat: CAT.DECO, name: 'Кристалл',  icon: '💎', cost: 0, style: 4, maker: 'crystal', notBuyable: true },
};

const _byCellId = new Map();
for (const k in ITEM_DEFS) {
  const d = ITEM_DEFS[k];
  if (d.cellId != null) _byCellId.set(d.cellId, d);
}
export function defByCellId(id) { return _byCellId.get(id); }

// Список объектов в порядке отображения внутри своей категории.
export const TOOLBAR_ORDER = [
  // действия
  'dig', 'fill', 'name', 'remove', 'dog',
  // кресты
  'cross_wood', 'cross_iron', 'cross_orthodox',
  // надгробия
  'tomb_simple', 'tomb_stone', 'tomb_marble', 'tomb_luxury', 'tomb_sarcophagus',
  // цветы
  'flower_white', 'flower_yellow', 'flower_red', 'flower_violet',
  'flower_lavender', 'flower_tulip', 'flower_lily', 'flower_rose',
  // дорожки
  'path_stone', 'path_brick', 'path_marble',
  // декор
  'bench', 'bench_gold', 'lamp', 'candle', 'wreath',
  'fence', 'fence_stone', 'angel', 'mausoleum', 'chapel',
  // природа
  'tree_sakura', 'tree_pine', 'tree_oak', 'shrub', 'pond',
];

export function buildItemMesh(itemId) {
  const def = ITEM_DEFS[itemId];
  if (!def || !def.maker) return null;
  return MAKERS[def.maker]();
}
export function buildPitMesh() { return MAKERS.pit(); }
export function buildFilledMesh() { return MAKERS.filled(); }

// Бонус за наличие соседних дорожек/цветов/декора у могилы.
export function neighborBonus(cellGet, x, z) {
  let bonus = 0;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue;
      const c = cellGet(x + dx, z + dz);
      if (c == null) continue;
      const d = _byCellId.get(c);
      if (!d) continue;
      if (d.cat === CAT.PATH) bonus += d.style ? d.style * 0.6 : 0.6;
      else if (d.cat === CAT.FLOWER) bonus += d.style * 0.4;
      else if (d.cat === CAT.DECO || d.cat === CAT.NATURE) bonus += d.style * 0.2;
    }
  }
  return Math.round(bonus * 10) / 10;
}
