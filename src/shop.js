// Ethical, cosmetic-only shop & lootboxes.
//
// Design principles:
//  * Currency is GEMS (камешки) — earned only by playing (achievements,
//    daily streak, mining ore, walking distance). No real-money purchases.
//  * Shop sells COSMETIC items only — block skins, tool tints, particle
//    palettes. Nothing in the shop affects gameplay numbers (damage, speed,
//    mining, etc.) — true ethical model, no pay-to-win.
//  * Lootboxes deliver random cosmetics. Drop rates are FULLY DISCLOSED
//    on the box itself. Items are never duplicated; if all owned, gems are
//    refunded.
//
// State is persisted in localStorage at `vc.shop.v1`.

const KEY = 'vc.shop.v1';

const RARITY = {
  common:    { color: '#cccccc', label: 'Обычный',  weight: 60 },
  uncommon:  { color: '#6ee7ff', label: 'Необычный', weight: 25 },
  rare:      { color: '#9b87ff', label: 'Редкий',   weight: 11 },
  epic:      { color: '#ffb84a', label: 'Эпический', weight: 3.5 },
  legendary: { color: '#ff5959', label: 'Легендарный', weight: 0.5 }
};

// Cosmetic catalog — purely visual. Each item has a unique id, a display
// name, a price (in gems) and a rarity tier. The `apply` function describes
// what visual effect activating it has.
export const CATALOG = [
  // Tool tints (purely visual — same stats, different colours)
  { id: 'tint_pickaxe_gold',  name: 'Кирка: золотой оттенок', kind: 'pickaxe_tint', tint: 0xf2cf3a, rarity: 'rare',     price: 250 },
  { id: 'tint_pickaxe_ruby',  name: 'Кирка: рубиновый оттенок', kind: 'pickaxe_tint', tint: 0xff5d6a, rarity: 'epic',  price: 600 },
  { id: 'tint_pickaxe_jade',  name: 'Кирка: нефритовый',      kind: 'pickaxe_tint', tint: 0x35d39a, rarity: 'uncommon', price: 120 },
  { id: 'tint_sword_obsidian',name: 'Меч: обсидиановый',      kind: 'sword_tint',   tint: 0x3a2150, rarity: 'rare',     price: 250 },
  { id: 'tint_sword_diamond', name: 'Меч: алмазный',          kind: 'sword_tint',   tint: 0x6cf6ff, rarity: 'legendary', price: 1500 },
  { id: 'tint_axe_amber',     name: 'Топор: янтарный',        kind: 'axe_tint',     tint: 0xffc257, rarity: 'uncommon', price: 120 },
  { id: 'tint_shovel_silver', name: 'Лопата: серебряная',     kind: 'shovel_tint',  tint: 0xeef3ff, rarity: 'common',   price: 60 },
  // Particle palettes
  { id: 'fx_break_neon',      name: 'Частицы: неон',          kind: 'break_palette', palette: 'neon',   rarity: 'rare',  price: 300 },
  { id: 'fx_break_pastel',    name: 'Частицы: пастель',        kind: 'break_palette', palette: 'pastel', rarity: 'common', price: 60 },
  { id: 'fx_break_fire',      name: 'Частицы: огонь',          kind: 'break_palette', palette: 'fire',   rarity: 'epic', price: 700 },
  // Crosshair styles
  { id: 'ch_diamond',         name: 'Прицел: ромб',            kind: 'crosshair',     style: 'diamond', rarity: 'common', price: 40 },
  { id: 'ch_circle',          name: 'Прицел: круг',            kind: 'crosshair',     style: 'circle',  rarity: 'common', price: 40 },
  { id: 'ch_dot',             name: 'Прицел: точка',           kind: 'crosshair',     style: 'dot',     rarity: 'uncommon', price: 90 },
  // Held-block frame
  { id: 'frame_gold',         name: 'Рамка слота: золотая',    kind: 'slot_frame',    style: 'gold',    rarity: 'rare',   price: 280 },
  { id: 'frame_violet',       name: 'Рамка слота: фиолетовая', kind: 'slot_frame',    style: 'violet',  rarity: 'uncommon', price: 110 },
];

export class Shop {
  constructor() {
    this.state = this._load();
    if (typeof this.state.gems !== 'number') this.state.gems = 0;
    if (!this.state.owned) this.state.owned = {};
    if (!this.state.equipped) this.state.equipped = {};
    this._save();
  }

  _load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) { /* noop */ }
    return { gems: 50, owned: {}, equipped: {} };
  }

  _save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch (_) {}
  }

  // Public API ----------------------------------------------------------

  gems() { return this.state.gems; }

  awardGems(amount, reason = '') {
    this.state.gems += amount;
    this._save();
    return { gems: this.state.gems, reason };
  }

  isOwned(id) { return !!this.state.owned[id]; }

  ownedItems() {
    return CATALOG.filter(c => this.state.owned[c.id]);
  }

  buy(id) {
    const item = CATALOG.find(c => c.id === id);
    if (!item) return { ok: false, reason: 'Не найдено' };
    if (this.isOwned(id)) return { ok: false, reason: 'Уже куплено' };
    if (this.state.gems < item.price) return { ok: false, reason: 'Не хватает камешков' };
    this.state.gems -= item.price;
    this.state.owned[id] = true;
    this._save();
    return { ok: true, item };
  }

  equip(id) {
    const item = CATALOG.find(c => c.id === id);
    if (!item || !this.isOwned(id)) return { ok: false };
    this.state.equipped[item.kind] = id;
    this._save();
    return { ok: true, item };
  }

  unequip(kind) {
    delete this.state.equipped[kind];
    this._save();
  }

  equippedFor(kind) {
    const id = this.state.equipped[kind];
    return id ? CATALOG.find(c => c.id === id) : null;
  }

  // Lootbox -------------------------------------------------------------
  //
  // Single tier with disclosed rates. Algorithm:
  //   1. Roll rarity by published weights.
  //   2. Pick a random un-owned item of that rarity. If none, refund.
  //   3. Mark owned, persist. Returns the item or { refund: true }.
  // Disclosed odds (always shown to the user): 60/25/11/3.5/0.5

  lootboxPrice() { return 200; }

  rates() {
    const total = Object.values(RARITY).reduce((s, r) => s + r.weight, 0);
    return Object.entries(RARITY).map(([k, v]) => ({ id: k, label: v.label, color: v.color, percent: (v.weight / total * 100) }));
  }

  openLootbox() {
    if (this.state.gems < this.lootboxPrice()) {
      return { ok: false, reason: 'Не хватает камешков' };
    }
    this.state.gems -= this.lootboxPrice();
    // weighted roll
    const total = Object.values(RARITY).reduce((s, r) => s + r.weight, 0);
    let roll = Math.random() * total;
    let chosen = 'common';
    for (const [k, v] of Object.entries(RARITY)) {
      if (roll < v.weight) { chosen = k; break; }
      roll -= v.weight;
    }
    const tierItems = CATALOG.filter(c => c.rarity === chosen && !this.isOwned(c.id));
    if (tierItems.length === 0) {
      // refund gems if collection complete for this tier
      this.state.gems += this.lootboxPrice();
      this._save();
      return { ok: true, refund: true, rarity: chosen };
    }
    const item = tierItems[Math.floor(Math.random() * tierItems.length)];
    this.state.owned[item.id] = true;
    this._save();
    return { ok: true, item, rarity: chosen };
  }
}

export function rarityMeta(name) { return RARITY[name]; }
