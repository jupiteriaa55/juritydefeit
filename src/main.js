// Game bootstrap: renderer, world, player, NPCs, redstone, UI, controls,
// shader-animated terrain, particles, held item, sky.

import * as THREE from 'three';
import { World, CHUNK_SIZE, WORLD_H, loadOrCreateSeed, newRandomSeed } from './world.js';
import { meshChunk } from './mesher.js';
import { atlasTexture } from './textures.js';
import { opaqueMaterial, transparentMaterial, tickMaterials } from './material.js';
import { Player } from './player.js';
import { Redstone } from './redstone.js';
import { NPC } from './npc.js';
import { buildCastle, buildVillage, flatten } from './structures.js';
import { UI } from './ui.js';
import { Touch } from './touch.js';
import { Tracker, Daily, loadInventory, saveInventory } from './achievements.js';
import { Shop } from './shop.js';
import { Particles } from './particles.js';
import { Held } from './held.js';
import { Sky } from './sky.js';
import * as B from './blocks.js';
import { HOTBAR } from './blocks.js';

// ----- Scene / Renderer -----
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.setClearColor(0x9ad0ff, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = true;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9ad0ff, 50, 160);
scene.background = new THREE.Color(0x9ad0ff);
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 500);

const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(80, 120, 60);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x4a3c2a, 0.55);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x8aa6ff, 0.0);
moon.position.set(-80, 100, -40);
scene.add(moon);

// ----- Game State -----
const seed = loadOrCreateSeed();
const world = new World(seed);
world.load();
const player = new Player(camera, world);
const redstone = new Redstone(world);
const ui = new UI();
const tracker = new Tracker();
const daily = new Daily();
const shop = new Shop();
const particles = new Particles(scene);
const held = new Held(renderer);
const sky = new Sky(scene);
const npcs = [];
const chunkMeshes = new Map(); // key -> { opaque, trans }
let timeOfDay = 0.45;
let dayLengthSec = 240;
let lastNight = false;

// ----- Inventory -----
const inventoryCounts = {};
function initInventory() {
  if (player.mode === 'creative') {
    for (const id of HOTBAR) inventoryCounts[id] = Infinity;
  } else {
    const saved = loadInventory();
    if (saved) for (const id of HOTBAR) inventoryCounts[id] = saved[id] || 0;
    else {
      for (const id of HOTBAR) inventoryCounts[id] = 0;
      inventoryCounts[B.PLANK] = 16;
      inventoryCounts[B.STONE] = 16;
    }
  }
}
function persistInventory() {
  if (player.mode !== 'creative') {
    const m = {};
    for (const id of HOTBAR) m[id] = inventoryCounts[id] === Infinity ? 0 : inventoryCounts[id];
    saveInventory(m);
  }
}
function giveItems(map) {
  for (const k of Object.keys(map)) {
    const id = +k;
    const n = map[k];
    if (inventoryCounts[id] === Infinity) continue;
    inventoryCounts[id] = (inventoryCounts[id] || 0) + n;
  }
  persistInventory();
  refreshHotbar();
}
tracker.giveItems = giveItems;
tracker.onUnlock = (a) => {
  ui.toast('ДОСТИЖЕНИЕ', a.name);
  shop.awardGems(20, a.id);
  ui.toast('+20 💎', 'За «' + a.name + '»', '#ffd84a');
  ui.updateGems(shop.gems());
};
ui.updateGems(shop.gems());

function openShop() {
  ui.showShop(shop, (id) => {
    const r = shop.buy(id);
    if (!r.ok) { ui.toast('МАГАЗИН', r.reason, '#ff8a8a'); return; }
    ui.toast('КУПЛЕНО', r.item.name, '#6ee7ff');
    openShop();
  }, (id, kind, mode) => {
    if (mode === 'off') shop.unequip(kind);
    else shop.equip(id);
    applyEquipped();
    openShop();
  }, () => {
    const r = shop.openLootbox();
    if (!r.ok) { ui.toast('СУНДУК', r.reason, '#ff8a8a'); return; }
    ui.showLootboxResult(r, shop);
    openShop();
  });
}

// Apply equipped cosmetics to the held-item renderer.
function applyEquipped() {
  const tints = {
    pickaxe: shop.equippedFor('pickaxe_tint')?.tint,
    sword:   shop.equippedFor('sword_tint')?.tint,
    axe:     shop.equippedFor('axe_tint')?.tint,
    shovel:  shop.equippedFor('shovel_tint')?.tint,
  };
  if (held.setTints) held.setTints(tints);
}

// ----- Hotbar -----
let activeSlot = 0;
function refreshHotbar() {
  ui.refreshHotbar(HOTBAR, (id) => inventoryCounts[id] ?? 0, activeSlot);
  // Update held item display
  const id = HOTBAR[activeSlot];
  if (id !== undefined) held.setHeld(id, true);
}
ui.buildHotbar(HOTBAR, (id) => inventoryCounts[id] ?? 0);
ui.onSlotClick = (i) => { activeSlot = i; refreshHotbar(); };
applyEquipped();
refreshHotbar();

// ----- Chunk management -----
const RENDER_RADIUS = 5;
function ensureChunksAround(pos) {
  const ccx = Math.floor(pos.x / CHUNK_SIZE);
  const ccz = Math.floor(pos.z / CHUNK_SIZE);
  for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
    for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
      world.ensureChunk(ccx + dx, ccz + dz);
    }
  }
  const keep = new Set();
  for (let dz = -RENDER_RADIUS - 1; dz <= RENDER_RADIUS + 1; dz++)
    for (let dx = -RENDER_RADIUS - 1; dx <= RENDER_RADIUS + 1; dx++)
      keep.add(world.key(ccx + dx, ccz + dz));
  for (const k of [...chunkMeshes.keys()]) {
    if (!keep.has(k)) {
      const m = chunkMeshes.get(k);
      if (m.opaque) { scene.remove(m.opaque); m.opaque.geometry.dispose(); }
      if (m.trans) { scene.remove(m.trans); m.trans.geometry.dispose(); }
      chunkMeshes.delete(k);
    }
  }
}

function rebuildDirtyChunks(maxPerFrame = 2) {
  let n = 0;
  for (const k of [...world.dirty]) {
    if (n >= maxPerFrame) break;
    world.dirty.delete(k);
    const [cx, cz] = k.split(',').map(Number);
    const chunk = world.chunks.get(k);
    if (!chunk) continue;
    const { opaque, trans } = meshChunk(world, chunk);
    let entry = chunkMeshes.get(k);
    if (entry) {
      if (entry.opaque) { scene.remove(entry.opaque); entry.opaque.geometry.dispose(); }
      if (entry.trans)  { scene.remove(entry.trans);  entry.trans.geometry.dispose(); }
    } else {
      entry = {};
      chunkMeshes.set(k, entry);
    }
    if (opaque) {
      const m = new THREE.Mesh(opaque, opaqueMaterial);
      m.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      m.frustumCulled = true;
      scene.add(m);
      entry.opaque = m;
    } else entry.opaque = null;
    if (trans) {
      const m = new THREE.Mesh(trans, transparentMaterial);
      m.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      m.frustumCulled = true;
      m.renderOrder = 1;
      scene.add(m);
      entry.trans = m;
    } else entry.trans = null;
    n++;
  }
}

function setupSpawn() {
  // pre-generate a generous area to find a sensible spawn (avoid ocean)
  for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
    for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
      world.ensureChunk(dx, dz);
    }
  }
  // Find a reasonably flat plains/forest area for castle and village
  function plot(x, z, w, d) {
    let total = 0, max = 0, min = 999;
    for (let i = 0; i < w; i += 2) for (let j = 0; j < d; j += 2) {
      const h = world.heightAt(x + i, z + j);
      total += h; max = Math.max(max, h); min = Math.min(min, h);
    }
    const avg = total / ((w/2 * d/2) || 1);
    return { avg, range: max - min };
  }
  // Start search around origin
  let castlePos = { x: -10, z: -10 };
  let bestScore = Infinity;
  for (let dx = -16; dx <= 16; dx += 4) {
    for (let dz = -16; dz <= 16; dz += 4) {
      const p = plot(dx, dz, 16, 14);
      // prefer flat above sea
      if (p.avg < 24) continue;
      const score = p.range * 2 + Math.abs(p.avg - 33);
      if (score < bestScore) { bestScore = score; castlePos = { x: dx, z: dz }; }
    }
  }
  const villagePos = { x: castlePos.x + 16, z: castlePos.z + 16 };
  flatten(world, castlePos.x - 1, castlePos.z - 1, 16, 14, B.GRASS);
  flatten(world, villagePos.x - 1, villagePos.z - 1, 32, 22, B.GRASS);
  buildCastle(world, castlePos.x, castlePos.z);
  const vill = buildVillage(world, villagePos.x, villagePos.z);
  // Demo redstone in front of the castle
  const cb = world.heightAt(castlePos.x + 1, castlePos.z - 1) + 1;
  for (let i = 0; i < 6; i++) {
    world.setBlock(castlePos.x + 1 + i, cb - 1, castlePos.z - 1, B.PATH, { persist: false });
    world.setBlock(castlePos.x + 1 + i, cb, castlePos.z - 1, B.AIR, { persist: false });
  }
  world.setBlock(castlePos.x + 1, cb, castlePos.z - 1, B.BUTTON, { persist: false });
  world.setBlock(castlePos.x + 2, cb, castlePos.z - 1, B.WIRE, { persist: false });
  world.setBlock(castlePos.x + 3, cb, castlePos.z - 1, B.WIRE, { persist: false });
  world.setBlock(castlePos.x + 4, cb, castlePos.z - 1, B.WIRE, { persist: false });
  world.setBlock(castlePos.x + 5, cb, castlePos.z - 1, B.LAMP_OFF, { persist: false });
  for (const home of vill.homes) npcs.push(new NPC(scene, world, home.npcSpawn));
  npcs.push(new NPC(scene, world, { x: vill.well.x + 2, y: vill.well.y, z: vill.well.z + 1 }));
  npcs.push(new NPC(scene, world, { x: vill.well.x - 2, y: vill.well.y, z: vill.well.z - 1 }));
  // Place player at plaza edge (gap between houses), well above ground
  const sx = vill.well.x - 5, sz = vill.well.z;
  // Clear a small bubble around spawn point so we never end up inside a wall
  const groundY = world.heightAt(sx, sz);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = 1; dy <= 3; dy++) {
        world.setBlock(sx + dx, groundY + dy, sz + dz, B.AIR, { persist: false });
      }
    }
  }
  player.position.set(sx + 0.5, groundY + 2, sz + 0.5);
  // Look toward the castle
  const dx = (castlePos.x + 7) - (sx + 0.5);
  const dz = (castlePos.z + 7) - (sz + 0.5);
  player.yaw = Math.atan2(-dx, -dz);
}
setupSpawn();

ensureChunksAround(player.position);
while (world.dirty.size > 0) rebuildDirtyChunks(world.dirty.size);

function setMode(mode) {
  player.setMode(mode);
  ui.setMode(mode);
  if (mode === 'creative') {
    for (const id of HOTBAR) inventoryCounts[id] = Infinity;
  } else {
    const saved = loadInventory();
    if (saved) for (const id of HOTBAR) inventoryCounts[id] = saved[id] || 0;
    else for (const id of HOTBAR) inventoryCounts[id] = inventoryCounts[id] === Infinity ? 0 : inventoryCounts[id];
    tracker.unlock('survivor');
  }
  refreshHotbar();
}
setMode('creative');
initInventory();
refreshHotbar();

// ----- Input -----
const keys = new Set();
function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
}
let touchActive = isMobile();
const touch = new Touch({
  move: (nx, ny) => { player.input.forward = -ny; player.input.right = nx; },
  look: (dx, dy) => {
    const sens = 0.005;
    player.yaw -= dx * sens;
    player.pitch -= dy * sens;
    player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.pitch));
  },
  jump: (down) => { player.input.jump = down; },
  place: () => { tryPlace(); },
  breakBlock: () => { tryBreak(); },
  toggleMode: () => { setMode(player.mode === 'creative' ? 'survival' : 'creative'); },
  nextSlot: () => { activeSlot = (activeSlot + 1) % HOTBAR.length; refreshHotbar(); }
});

const startScreen = document.getElementById('start');
const playBtn = document.getElementById('play-btn');
let gameStarted = false;
playBtn.addEventListener('click', startGame);

function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  startScreen.style.display = 'none';
  if (touchActive) touch.enable(true);
  else canvas.requestPointerLock?.();
  setTimeout(() => { if (daily.canClaim()) ui.showDaily(daily, false, null); }, 600);
}

canvas.addEventListener('click', () => {
  if (!gameStarted) return;
  if (touchActive) return;
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
});
document.addEventListener('mousemove', (e) => {
  if (!gameStarted) return;
  if (document.pointerLockElement !== canvas) return;
  const sens = 0.0025;
  player.yaw -= e.movementX * sens;
  player.pitch -= e.movementY * sens;
  player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.pitch));
});
canvas.addEventListener('mousedown', (e) => {
  if (!gameStarted) return;
  if (touchActive) return;
  if (document.pointerLockElement !== canvas) return;
  if (e.button === 0) tryBreak();
  else if (e.button === 2) tryPlace();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('wheel', (e) => {
  if (!gameStarted) return;
  const dir = Math.sign(e.deltaY);
  activeSlot = (activeSlot + dir + HOTBAR.length) % HOTBAR.length;
  refreshHotbar();
});

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5) - 1;
    if (n >= 0 && n < HOTBAR.length) { activeSlot = n; refreshHotbar(); }
  }
  if (e.code === 'KeyF') setMode(player.mode === 'creative' ? 'survival' : 'creative');
  if (e.code === 'KeyJ') ui.showAchievements(tracker.unlockedSet());
  if (e.code === 'KeyK') ui.showDaily(daily, !daily.canClaim(), null);
  if (e.code === 'KeyB') openShop();
  if (e.code === 'KeyE') tryInteract();
  if (e.code === 'KeyR') {
    if (confirm('Сгенерировать новый случайный мир? Текущие изменения сохранятся отдельно.')) {
      const s = newRandomSeed();
      try { localStorage.setItem('vc.seed.v1', String(s)); } catch (_) {}
      location.reload();
    }
  }
  if (e.code === 'Escape') ui.hideDialog();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'claim-daily') {
    const reward = daily.claim();
    if (reward) {
      giveItems(reward.items);
      ui.toast('НАГРАДА', reward.label, '#6ee7ff');
      const gemBonus = 25 + 10 * Math.max(0, daily.state.streak - 1);
      shop.awardGems(gemBonus);
      ui.updateGems(shop.gems());
      ui.toast('+' + gemBonus + ' 💎', 'Ежедневный бонус', '#ffd84a');
      ui.showDaily(daily, true, reward);
    }
  }
});

function pollKeyboard() {
  player.input.forward = (keys.has('KeyW') ? 1 : 0) + (keys.has('KeyS') ? -1 : 0);
  player.input.right   = (keys.has('KeyD') ? 1 : 0) + (keys.has('KeyA') ? -1 : 0);
  player.input.sprint  = keys.has('ShiftLeft') || keys.has('ShiftRight');
  player.input.jump    = keys.has('Space');
  player.input.descend = keys.has('ControlLeft') || keys.has('ControlRight');
}

function tryBreak() {
  const r = player.raycast(6);
  if (!r) { held.triggerSwing(); return; }
  const id = r.blockId;
  if (id === B.AIR) return;
  held.triggerSwing();
  if (id === B.BEDROCK) { ui.toast('БЕДРОК', 'Слишком прочный'); return; }
  if (id === B.BUTTON) {
    redstone.activateButton(r.hit.x, r.hit.y, r.hit.z);
    tracker.unlock('redstone_engineer');
    return;
  }
  const baseId = (id === B.LAMP_ON) ? B.LAMP_OFF : id;
  particles.spawnBreak(baseId, r.hit.x, r.hit.y, r.hit.z);
  world.setBlock(r.hit.x, r.hit.y, r.hit.z, B.AIR);
  if (player.mode === 'survival') {
    if (HOTBAR.includes(baseId) && inventoryCounts[baseId] !== Infinity) {
      inventoryCounts[baseId] = (inventoryCounts[baseId] || 0) + 1;
      persistInventory();
    }
  }
  tracker.onBlockBreak(baseId);
  // Reward gems for mining ores (cosmetic-only currency, fully gameplay-earned)
  const oreGems = { [B.COAL_ORE]: 1, [B.IRON_ORE]: 2, [B.GOLD_ORE]: 4, [B.DIAMOND_ORE]: 10 };
  if (oreGems[baseId]) {
    shop.awardGems(oreGems[baseId]);
    ui.updateGems?.(shop.gems());
  }
  refreshHotbar();
}

function tryPlace() {
  const r = player.raycast(6);
  if (!r) return;
  if (r.blockId === B.BUTTON) {
    redstone.activateButton(r.hit.x, r.hit.y, r.hit.z);
    tracker.unlock('redstone_engineer');
    return;
  }
  held.triggerSwing();
  const id = HOTBAR[activeSlot];
  if (player.mode !== 'creative') {
    if ((inventoryCounts[id] || 0) <= 0) return;
  }
  const px = Math.floor(player.position.x);
  const pz = Math.floor(player.position.z);
  const py1 = Math.floor(player.position.y);
  const py2 = Math.floor(player.position.y + 1.5);
  if (r.prev.x === px && r.prev.z === pz && (r.prev.y === py1 || r.prev.y === py2)) return;
  world.setBlock(r.prev.x, r.prev.y, r.prev.z, id);
  if (player.mode !== 'creative' && inventoryCounts[id] !== Infinity) inventoryCounts[id]--;
  tracker.onBlockPlace(id, r.prev.y);
  refreshHotbar();
}

function tryInteract() {
  if (!gameStarted) return;
  let best = null, bestD = 4;
  for (const n of npcs) {
    const dx = n.mesh.position.x - player.position.x;
    const dz = n.mesh.position.z - player.position.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD) { best = n; bestD = d; }
  }
  if (!best) {
    if (ui.dialogEl.style.display === 'block') ui.hideDialog();
    return;
  }
  best.talking = true;
  setTimeout(() => { best.talking = false; }, 5000);
  ui.showDialog(`${best.name} (${best.profession})`, best.nextLine());
  tracker.unlock('village_visit');
}

function applyTimeOfDay() {
  const t = timeOfDay;
  const ang = t * Math.PI * 2 - Math.PI / 2;
  sun.position.set(Math.cos(ang) * 100, Math.sin(ang) * 100, 30);
  let dayInt = Math.max(0, Math.sin(ang));
  sun.intensity = 0.2 + dayInt * 1.0;
  hemi.intensity = 0.25 + dayInt * 0.4;
  moon.intensity = (1 - dayInt) * 0.4;
  const dayCol = new THREE.Color(0x9ad0ff);
  const nightCol = new THREE.Color(0x0a0f25);
  const sunsetCol = new THREE.Color(0xf08a55);
  let skyCol;
  if (dayInt > 0.4) skyCol = dayCol.clone();
  else if (dayInt > 0.0) skyCol = sunsetCol.clone().lerp(dayCol, dayInt / 0.4);
  else skyCol = nightCol.clone();
  scene.background = skyCol;
  scene.fog.color = skyCol;
  scene.fog.near = 50;
  scene.fog.far = 160;
}

let last = performance.now();
let timeAccum = 0;
function loop() {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  timeAccum += dt;
  tickMaterials(timeAccum);

  if (gameStarted) {
    pollKeyboard();
    player.update(dt);
    timeOfDay = (timeOfDay + dt / dayLengthSec) % 1;
    const isNight = timeOfDay > 0.5 && timeOfDay < 0.95;
    if (isNight && !lastNight) tracker.unlock('night_owl');
    lastNight = isNight;
    applyTimeOfDay();
    sky.update(dt, timeOfDay, camera.position);
    redstone.update();
    particles.update(dt);
    held.update(dt);
    for (const n of npcs) n.update(dt);
    ensureChunksAround(player.position);
    rebuildDirtyChunks(2);
  }

  renderer.render(scene, camera);
  if (gameStarted) held.render();

  requestAnimationFrame(loop);
}
loop();

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
// Debug exposure
window.dgm = { renderer, scene, camera, world, player, shop, sky, get t(){return timeOfDay}, set t(v){timeOfDay=v} };
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

window.addEventListener('touchstart', () => { if (!touchActive) { touchActive = true; if (gameStarted) touch.enable(true); } }, { once: true, passive: true });
window.addEventListener('beforeunload', () => { try { world.persist(); persistInventory(); } catch (e) {} });

import { registerSW } from 'virtual:pwa-register';
registerSW({ immediate: true });
