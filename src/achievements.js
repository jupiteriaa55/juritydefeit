// Achievements + Daily Reward system.
// Persistence via localStorage. Awards come into the player's inventory by
// dispatching a callback (game.giveItems(map)).

import * as B from './blocks.js';
import { blockName } from './blocks.js';

const KEY_ACHV = 'vc.achv.v1';
const KEY_DAILY = 'vc.daily.v1';
const KEY_PROGRESS = 'vc.progress.v1';
const KEY_INV = 'vc.inv.v1';

export const ACHIEVEMENTS = [
  { id: 'first_block_break',  name: 'Первый удар',      desc: 'Сломайте свой первый блок.',                       reward: { [B.PLANK]: 4 } },
  { id: 'first_block_place',  name: 'Строитель',         desc: 'Поставьте свой первый блок.',                      reward: { [B.STONE]: 4 } },
  { id: 'tree_chopper',       name: 'Дровосек',          desc: 'Сломайте 10 блоков дерева.',                       reward: { [B.PLANK]: 16 } },
  { id: 'miner',              name: 'Шахтёр',            desc: 'Сломайте 25 блоков камня.',                        reward: { [B.COBBLE]: 16 } },
  { id: 'farmer',             name: 'Земледелец',        desc: 'Сломайте 10 блоков травы.',                        reward: { [B.GRASS]: 8 } },
  { id: 'castle_visit',       name: 'Гость замка',       desc: 'Зайдите в стартовый замок.',                       reward: { [B.BRICK]: 16 } },
  { id: 'village_visit',      name: 'Гость деревни',     desc: 'Поговорите с жителем.',                            reward: { [B.LAMP_OFF]: 4 } },
  { id: 'redstone_engineer',  name: 'Редстоун-инженер',  desc: 'Включите лампу нажатием кнопки.',                  reward: { [B.LAMP_OFF]: 8, [B.WIRE]: 16, [B.BUTTON]: 4 } },
  { id: 'night_owl',          name: 'Совa',              desc: 'Дождитесь ночи.',                                  reward: { [B.LAMP_OFF]: 4 } },
  { id: 'sky_climber',        name: 'Небоскрёб',         desc: 'Постройте на высоте 50+ блоков над землёй.',       reward: { [B.GLASS]: 16 } },
  { id: 'home_owner',         name: 'Дом, милый дом',    desc: 'Поставьте 50 блоков.',                             reward: { [B.PLANK]: 32, [B.GLASS]: 8 } },
  { id: 'survivor',           name: 'Выживший',          desc: 'Включите режим выживания.',                        reward: { [B.WOOD]: 8 } }
];

export const DAILY_REWARDS = [
  { day: 1, items: { [B.PLANK]: 8 },   label: '8 досок' },
  { day: 2, items: { [B.STONE]: 16 },  label: '16 камня' },
  { day: 3, items: { [B.GLASS]: 8 },   label: '8 стекла' },
  { day: 4, items: { [B.LAMP_OFF]: 4, [B.WIRE]: 8 }, label: '4 лампы + 8 проводов' },
  { day: 5, items: { [B.BRICK]: 16 },  label: '16 кирпича' },
  { day: 6, items: { [B.WOOD]: 16 },   label: '16 брёвен' },
  { day: 7, items: { [B.LAMP_OFF]: 16, [B.WIRE]: 32, [B.BUTTON]: 8, [B.BRICK]: 16 }, label: 'Большой комплект редстоуна и блоков' }
];

export class Tracker {
  constructor() {
    this.unlocked = new Set();
    this.progress = { broken: {}, placed: 0, brokenTotal: 0 };
    this.load();
    this.onUnlock = null;        // (achievement) => void
    this.giveItems = null;       // (map) => void
  }

  load() {
    try {
      const a = JSON.parse(localStorage.getItem(KEY_ACHV) || '[]');
      this.unlocked = new Set(a);
      const p = JSON.parse(localStorage.getItem(KEY_PROGRESS) || '{}');
      this.progress = Object.assign({ broken: {}, placed: 0, brokenTotal: 0 }, p);
    } catch (e) { /* ignore */ }
  }

  save() {
    localStorage.setItem(KEY_ACHV, JSON.stringify([...this.unlocked]));
    localStorage.setItem(KEY_PROGRESS, JSON.stringify(this.progress));
  }

  unlock(id) {
    if (this.unlocked.has(id)) return false;
    const a = ACHIEVEMENTS.find(x => x.id === id);
    if (!a) return false;
    this.unlocked.add(id);
    this.save();
    if (a.reward && this.giveItems) this.giveItems(a.reward);
    if (this.onUnlock) this.onUnlock(a);
    return true;
  }

  onBlockBreak(blockId) {
    this.progress.brokenTotal = (this.progress.brokenTotal || 0) + 1;
    this.progress.broken[blockId] = (this.progress.broken[blockId] || 0) + 1;
    this.save();
    this.unlock('first_block_break');
    if (blockId === B.WOOD && this.progress.broken[B.WOOD] >= 10) this.unlock('tree_chopper');
    if (blockId === B.STONE && this.progress.broken[B.STONE] >= 25) this.unlock('miner');
    if (blockId === B.GRASS && this.progress.broken[B.GRASS] >= 10) this.unlock('farmer');
  }

  onBlockPlace(blockId, y) {
    this.progress.placed = (this.progress.placed || 0) + 1;
    this.save();
    this.unlock('first_block_place');
    if (this.progress.placed >= 50) this.unlock('home_owner');
    if (y >= 50) this.unlock('sky_climber');
  }

  unlockedSet() { return this.unlocked; }
}

export class Daily {
  constructor() {
    this.state = this.load();
  }
  load() {
    try { return JSON.parse(localStorage.getItem(KEY_DAILY) || 'null') || { lastClaim: null, streak: 0 }; }
    catch (e) { return { lastClaim: null, streak: 0 }; }
  }
  save() { localStorage.setItem(KEY_DAILY, JSON.stringify(this.state)); }
  todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
  yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
  canClaim() { return this.state.lastClaim !== this.todayKey(); }
  currentDay() {
    if (!this.canClaim()) return ((this.state.streak - 1) % 7) + 1;
    return ((this.state.streak) % 7) + 1;
  }
  claim() {
    if (!this.canClaim()) return null;
    if (this.state.lastClaim === this.yesterdayKey()) {
      this.state.streak += 1;
    } else {
      this.state.streak = 1;
    }
    this.state.lastClaim = this.todayKey();
    this.save();
    const day = ((this.state.streak - 1) % 7) + 1;
    return DAILY_REWARDS.find(r => r.day === day);
  }
}

// Inventory persistence
export function loadInventory() {
  try {
    const raw = localStorage.getItem(KEY_INV);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const map = {};
    for (const k of Object.keys(obj)) map[+k] = obj[k];
    return map;
  } catch (e) { return null; }
}
export function saveInventory(invMap) {
  try { localStorage.setItem(KEY_INV, JSON.stringify(invMap)); } catch (e) { /* ignore */ }
}
export { blockName };
