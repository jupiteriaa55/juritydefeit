// Block type definitions. Each block has top/side/bottom face tile names that
// map into the procedural texture atlas.
//
// Solid: blocks player movement.
// Transparent: still rendered but does not occlude neighbours from the inside.
// Wave: vertex-shader animation tag (0=none, 1=grass-top sway, 2=leaves sway, 3=water ripple).

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
// new blocks
export const COAL_ORE = 18;
export const IRON_ORE = 19;
export const GOLD_ORE = 20;
export const DIAMOND_ORE = 21;
export const SNOW = 22;
export const ICE = 23;
export const GRAVEL = 24;
export const BEDROCK = 25;
export const OBSIDIAN = 26;
export const CACTUS = 27;
export const FLOWER_RED = 28;
export const FLOWER_YELLOW = 29;
export const TALL_GRASS = 30;
export const TORCH = 31;
export const SNOW_GRASS = 32;

const def = (name, opts = {}) => ({
  name,
  solid: opts.solid !== false,
  transparent: !!opts.transparent,
  emissive: opts.emissive || 0,
  redstone: opts.redstone || null,
  wave: opts.wave || 0,
  cross: !!opts.cross   // rendered as crossed quads (flowers, grass, torch)
});

export const BLOCKS = {
  [AIR]:          { name: 'air', solid: false, transparent: true, wave: 0, cross: false },
  [GRASS]:        def('Трава'),
  [DIRT]:         def('Земля'),
  [STONE]:        def('Камень'),
  [WOOD]:         def('Бревно'),
  [LEAVES]:       def('Листва',     { transparent: true, wave: 2 }),
  [SAND]:         def('Песок'),
  [WATER]:        def('Вода',       { solid: false, transparent: true, wave: 3 }),
  [PLANK]:        def('Доски'),
  [COBBLE]:       def('Булыжник'),
  [BRICK]:        def('Кирпич'),
  [GLASS]:        def('Стекло',     { transparent: true }),
  [LAMP_OFF]:     def('Лампа',      { redstone: 'lamp' }),
  [LAMP_ON]:      def('Лампа+',     { emissive: 0xfff0a0, redstone: 'lamp_on' }),
  [WIRE]:         def('Провод',     { redstone: 'wire' }),
  [BUTTON]:       def('Кнопка',     { redstone: 'button' }),
  [ROOF]:         def('Крыша'),
  [PATH]:         def('Дорожка'),
  [COAL_ORE]:     def('Уголь'),
  [IRON_ORE]:     def('Железо'),
  [GOLD_ORE]:     def('Золото'),
  [DIAMOND_ORE]:  def('Алмаз'),
  [SNOW]:         def('Снег'),
  [ICE]:          def('Лёд',        { transparent: true }),
  [GRAVEL]:       def('Гравий'),
  [BEDROCK]:      def('Бедрок'),
  [OBSIDIAN]:     def('Обсидиан'),
  [CACTUS]:       def('Кактус'),
  [FLOWER_RED]:   def('Мак',        { solid: false, transparent: true, cross: true }),
  [FLOWER_YELLOW]:def('Одуванчик',  { solid: false, transparent: true, cross: true }),
  [TALL_GRASS]:   def('Высокая трава', { solid: false, transparent: true, cross: true, wave: 1 }),
  [TORCH]:        def('Факел',      { solid: false, transparent: true, cross: true, emissive: 0xffb049 }),
  [SNOW_GRASS]:   def('Снежная трава')
};

export function isSolid(id) { return !!BLOCKS[id] && BLOCKS[id].solid; }
export function isTransparent(id) { return !BLOCKS[id] || BLOCKS[id].transparent; }
export function isOpaque(id) { return id !== AIR && !BLOCKS[id]?.transparent; }
export function isCross(id) { return !!BLOCKS[id]?.cross; }
export function blockName(id) { return BLOCKS[id]?.name || 'air'; }
export function waveOf(id) { return BLOCKS[id]?.wave || 0; }

// Hotbar palette (Creative gives all of these).
export const HOTBAR = [GRASS, DIRT, STONE, COBBLE, PLANK, BRICK, GLASS, TORCH, LAMP_OFF, BUTTON];

// Tools list for held-item display.
export const TOOL_PICKAXE = 'pickaxe';
export const TOOL_SHOVEL  = 'shovel';
export const TOOL_AXE     = 'axe';
export const TOOL_SWORD   = 'sword';
