// Block type definitions. Color stored as 0xRRGGBB triplets per face slot.
// Faces: [+x, -x, +y, -y, +z, -z] but for simplicity we use top/side/bottom triplet.
// Solid: blocks player movement and is rendered with full faces.
// Transparent: still rendered but does not occlude neighbours from the inside.

export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const WOOD = 4;
export const LEAVES = 5;
export const SAND = 6;
export const WATER = 7;
export const PLANK = 8;
export const COBBLE = 9;
export const BRICK = 10;
export const GLASS = 11;
export const LAMP_OFF = 12;
export const LAMP_ON = 13;
export const WIRE = 14;
export const BUTTON = 15;
export const ROOF = 16;
export const PATH = 17;

const def = (name, top, side, bottom, opts = {}) => ({
  name,
  top,
  side,
  bottom,
  solid: opts.solid !== false,
  transparent: !!opts.transparent,
  emissive: opts.emissive || 0,
  redstone: opts.redstone || null
});

export const BLOCKS = {
  [AIR]:      { name: 'air', solid: false, transparent: true, top: 0, side: 0, bottom: 0 },
  [GRASS]:    def('Трава',     0x6cbf3a, 0x7a5a36, 0x6b4a2a),
  [DIRT]:     def('Земля',     0x8b5a2b, 0x8b5a2b, 0x8b5a2b),
  [STONE]:    def('Камень',    0x7d7d7d, 0x7d7d7d, 0x7d7d7d),
  [WOOD]:     def('Бревно',    0x6b4a25, 0x8a6135, 0x6b4a25),
  [LEAVES]:   def('Листва',    0x3f8a2f, 0x3f8a2f, 0x3f8a2f, { transparent: true }),
  [SAND]:     def('Песок',     0xe2cf86, 0xe2cf86, 0xe2cf86),
  [WATER]:    def('Вода',      0x2a6dd6, 0x2a6dd6, 0x2a6dd6, { solid: false, transparent: true }),
  [PLANK]:    def('Доски',     0xb3823f, 0xb3823f, 0xb3823f),
  [COBBLE]:   def('Булыжник',  0x6e6e6e, 0x6e6e6e, 0x6e6e6e),
  [BRICK]:    def('Кирпич',    0xa8493b, 0xa8493b, 0xa8493b),
  [GLASS]:    def('Стекло',    0xc7e7ff, 0xc7e7ff, 0xc7e7ff, { transparent: true }),
  [LAMP_OFF]: def('Лампа',     0x6b5018, 0x6b5018, 0x6b5018, { redstone: 'lamp' }),
  [LAMP_ON]:  def('Лампа+',    0xfff0a0, 0xfff0a0, 0xfff0a0, { emissive: 0xfff0a0, redstone: 'lamp_on' }),
  [WIRE]:     def('Провод',    0xc02a2a, 0xc02a2a, 0xc02a2a, { redstone: 'wire' }),
  [BUTTON]:   def('Кнопка',    0xe65a2e, 0xc94020, 0xc94020, { redstone: 'button' }),
  [ROOF]:     def('Крыша',     0x6e2a23, 0x6e2a23, 0x6e2a23),
  [PATH]:     def('Дорожка',   0x9b8761, 0x8a6f4a, 0x6f5a3a)
};

export function isSolid(id) {
  const b = BLOCKS[id];
  return !!b && b.solid;
}

export function isTransparent(id) {
  const b = BLOCKS[id];
  return !b || b.transparent;
}

export function isOpaque(id) {
  return id !== AIR && !BLOCKS[id]?.transparent;
}

export function blockName(id) {
  return BLOCKS[id]?.name || 'air';
}

export function blockColor(id, face) {
  const b = BLOCKS[id];
  if (!b) return 0xffffff;
  if (face === 'top') return b.top;
  if (face === 'bottom') return b.bottom;
  return b.side;
}

// Hotbar palette (Creative gives all of these).
export const HOTBAR = [GRASS, DIRT, STONE, COBBLE, PLANK, BRICK, GLASS, LAMP_OFF, BUTTON, WIRE];
