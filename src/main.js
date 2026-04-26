// Game bootstrap. Wires renderer, world, player, NPCs, redstone, UI, controls.

import * as THREE from 'three';
import { World, CHUNK_SIZE, WORLD_H } from './world.js';
import { meshChunk } from './mesher.js';
import { atlasTexture } from './textures.js';
import { Player } from './player.js';
import { Redstone } from './redstone.js';
import { NPC } from './npc.js';
import { buildCastle, buildVillage, flatten } from './structures.js';
import { UI } from './ui.js';
import { Touch } from './touch.js';
import { Tracker, Daily, loadInventory, saveInventory, ACHIEVEMENTS, DAILY_REWARDS } from './achievements.js';
import * as B from './blocks.js';
import { HOTBAR, blockName } from './blocks.js';

// ----- Scene / Renderer -----
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9ad0ff, 40, 140);
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

// Materials
const opaqueMat = new THREE.MeshLambertMaterial({
  map: atlasTexture,
  vertexColors: true,
  transparent: false,
  alphaTest: 0.2,
  side: THREE.FrontSide
});
const transMat = new THREE.MeshLambertMaterial({
  map: atlasTexture,
  vertexColors: true,
  transparent: true,
  alphaTest: 0.05,
  depthWrite: false,
  side: THREE.DoubleSide
});

// ----- Game State -----
const world = new World(2024);
world.load();
const player = new Player(camera, world);
const redstone = new Redstone(world);
const ui = new UI();
const tracker = new Tracker();
const daily = new Daily();
const npcs = [];
const chunkMeshes = new Map(); // key -> { opaque, trans }
let modeDirty = false;
let timeOfDay = 0.30; // 0..1, 0.25 = noon, 0.75 = midnight
let dayCount = 0;
let dayLengthSec = 240;
let lastNight = false;

// ----- Inventory -----
const inventoryCounts = {}; // blockId -> count
function initInventory() {
  if (player.mode === 'creative') {
    for (const id of HOTBAR) inventoryCounts[id] = Infinity;
  } else {
    const saved = loadInventory();
    if (saved) {
      for (const id of HOTBAR) inventoryCounts[id] = saved[id] || 0;
    } else {
      for (const id of HOTBAR) inventoryCounts[id] = 0;
      // Survival starter kit
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
tracker.onUnlock = (a) => ui.toast('ДОСТИЖЕНИЕ', a.name);

// ----- Hotbar -----
let activeSlot = 0;
function refreshHotbar() {
  ui.refreshHotbar(HOTBAR, (id) => inventoryCounts[id] ?? 0, activeSlot);
}
ui.buildHotbar(HOTBAR, (id) => inventoryCounts[id] ?? 0);
ui.onSlotClick = (i) => { activeSlot = i; refreshHotbar(); };

// ----- Initial world generation around spawn -----
const RENDER_RADIUS = 5; // chunks (radius)
function ensureChunksAround(pos) {
  const ccx = Math.floor(pos.x / CHUNK_SIZE);
  const ccz = Math.floor(pos.z / CHUNK_SIZE);
  for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
    for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
      world.ensureChunk(ccx + dx, ccz + dz);
    }
  }
  // unload far chunks
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
      const m = new THREE.Mesh(opaque, opaqueMat);
      m.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      m.frustumCulled = true;
      scene.add(m);
      entry.opaque = m;
    } else entry.opaque = null;
    if (trans) {
      const m = new THREE.Mesh(trans, transMat);
      m.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
      m.frustumCulled = true;
      scene.add(m);
      entry.trans = m;
    } else entry.trans = null;
    n++;
  }
}

function setupSpawn() {
  // pre-generate a generous area
  for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
    for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
      world.ensureChunk(dx, dz);
    }
  }
  // Choose castle/village positions; flatten ground first
  const castlePos = { x: -10, z: -10 };
  const villagePos = { x: 6, z: 6 };
  flatten(world, castlePos.x - 1, castlePos.z - 1, 16, 14, B.GRASS);
  flatten(world, villagePos.x - 1, villagePos.z - 1, 32, 22, B.GRASS);
  buildCastle(world, castlePos.x, castlePos.z);
  const vill = buildVillage(world, villagePos.x, villagePos.z);
  // Build a small redstone demo near castle entrance: button -> wires -> lamp
  const cb = world.heightAt(-3, -1) + 1; // ground level near castle path
  // ensure surface flat
  for (let i = 0; i < 6; i++) {
    world.setBlock(-3 + i, cb - 1, -1, B.PATH, { persist: false });
    world.setBlock(-3 + i, cb, -1, B.AIR, { persist: false });
  }
  world.setBlock(-3, cb, -1, B.BUTTON, { persist: false });
  world.setBlock(-2, cb, -1, B.WIRE, { persist: false });
  world.setBlock(-1, cb, -1, B.WIRE, { persist: false });
  world.setBlock(0, cb, -1, B.WIRE, { persist: false });
  world.setBlock(1, cb, -1, B.LAMP_OFF, { persist: false });
  // spawn NPCs
  for (const home of vill.homes) {
    const npc = new NPC(scene, world, home.npcSpawn);
    npcs.push(npc);
  }
  // village elder near well
  npcs.push(new NPC(scene, world, { x: vill.well.x + 2, y: vill.well.y, z: vill.well.z + 1 }));
  npcs.push(new NPC(scene, world, { x: vill.well.x - 2, y: vill.well.y, z: vill.well.z - 1 }));
  // place player on top of ground above spawn
  const sx = villagePos.x + 14, sz = villagePos.z + 1;
  const sy = world.heightAt(sx, sz) + 2;
  player.position.set(sx + 0.5, sy, sz + 0.5);
  player.yaw = Math.PI; // face -Z
}
setupSpawn();

// Initial mesh build
ensureChunksAround(player.position);
while (world.dirty.size > 0) rebuildDirtyChunks(world.dirty.size);

// ----- Modes -----
function setMode(mode) {
  player.setMode(mode);
  modeDirty = true;
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
  if (touchActive) {
    touch.enable(true);
  } else {
    canvas.requestPointerLock?.();
  }
  // Daily reward: open if first time today
  setTimeout(() => {
    if (daily.canClaim()) ui.showDaily(daily, false, null);
  }, 600);
}

// Pointer lock controls (desktop)
canvas.addEventListener('click', () => {
  if (!gameStarted) return;
  if (touchActive) return;
  if (document.pointerLockElement !== canvas) canvas.requestPointerLock?.();
});
document.addEventListener('pointerlockchange', () => {
  // no-op; mouse handlers gate themselves on pointerLockElement
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
  // Hotbar 1..9
  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5) - 1;
    if (n >= 0 && n < HOTBAR.length) { activeSlot = n; refreshHotbar(); }
  }
  if (e.code === 'KeyF') setMode(player.mode === 'creative' ? 'survival' : 'creative');
  if (e.code === 'KeyJ') ui.showAchievements(tracker.unlockedSet());
  if (e.code === 'KeyK') ui.showDaily(daily, !daily.canClaim(), null);
  if (e.code === 'KeyE') tryInteract();
  if (e.code === 'Escape') { ui.hideDialog(); }
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

document.addEventListener('click', (e) => {
  // claim button inside daily modal
  if (e.target && e.target.id === 'claim-daily') {
    const reward = daily.claim();
    if (reward) {
      giveItems(reward.items);
      ui.toast('НАГРАДА', reward.label, '#6ee7ff');
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
  if (!r) return;
  const id = r.blockId;
  if (id === B.AIR) return;
  if (id === B.BUTTON) {
    redstone.activateButton(r.hit.x, r.hit.y, r.hit.z);
    tracker.unlock('redstone_engineer');
    return;
  }
  // If lamp is currently ON because of pulse, treat as off for inventory
  const baseId = (id === B.LAMP_ON) ? B.LAMP_OFF : id;
  world.setBlock(r.hit.x, r.hit.y, r.hit.z, B.AIR);
  if (player.mode === 'survival') {
    if (HOTBAR.includes(baseId) && inventoryCounts[baseId] !== Infinity) {
      inventoryCounts[baseId] = (inventoryCounts[baseId] || 0) + 1;
      persistInventory();
    }
  }
  tracker.onBlockBreak(baseId);
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
  const id = HOTBAR[activeSlot];
  if (player.mode !== 'creative') {
    if ((inventoryCounts[id] || 0) <= 0) return;
  }
  // Don't place inside the player
  const px = Math.floor(player.position.x);
  const pz = Math.floor(player.position.z);
  const py1 = Math.floor(player.position.y);
  const py2 = Math.floor(player.position.y + 1.5);
  if (r.prev.x === px && r.prev.z === pz && (r.prev.y === py1 || r.prev.y === py2)) return;
  if (B.BLOCKS[id]?.solid === false) {/* allow placing wires/water/buttons in air anyway */}
  world.setBlock(r.prev.x, r.prev.y, r.prev.z, id);
  if (player.mode !== 'creative' && inventoryCounts[id] !== Infinity) inventoryCounts[id]--;
  tracker.onBlockPlace(id, r.prev.y);
  refreshHotbar();
}

function tryInteract() {
  // closest npc within 3 units in front
  if (!gameStarted) return;
  let best = null, bestD = 4;
  for (const n of npcs) {
    const dx = n.mesh.position.x - player.position.x;
    const dz = n.mesh.position.z - player.position.z;
    const d = Math.hypot(dx, dz);
    if (d < bestD) {
      // check angle: must be in front of view, roughly
      const yaw = Math.atan2(-Math.sin(player.yaw), -Math.cos(player.yaw));
      // simpler: just within distance
      best = n; bestD = d;
    }
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

// ----- Day/Night -----
function applyTimeOfDay() {
  // 0.0 sunrise; 0.25 noon; 0.5 sunset; 0.75 midnight
  const t = timeOfDay;
  const ang = t * Math.PI * 2 - Math.PI / 2;
  sun.position.set(Math.cos(ang) * 100, Math.sin(ang) * 100, 30);
  // sun visibility
  let dayInt = Math.max(0, Math.sin(ang));
  sun.intensity = 0.2 + dayInt * 1.0;
  hemi.intensity = 0.25 + dayInt * 0.4;
  moon.intensity = (1 - dayInt) * 0.4;
  // sky color
  const dayCol = new THREE.Color(0x9ad0ff);
  const nightCol = new THREE.Color(0x0a0f25);
  const sunsetCol = new THREE.Color(0xf08a55);
  let sky;
  if (dayInt > 0.4) sky = dayCol.clone();
  else if (dayInt > 0.0) sky = sunsetCol.clone().lerp(dayCol, dayInt / 0.4);
  else sky = nightCol.clone();
  scene.background = sky;
  scene.fog.color = sky;
  scene.fog.near = 50;
  scene.fog.far = 160;
}

// ----- Main loop -----
let last = performance.now();
function loop() {
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  if (gameStarted) {
    pollKeyboard();
    player.update(dt);
    timeOfDay = (timeOfDay + dt / dayLengthSec) % 1;
    const isNight = timeOfDay > 0.5 && timeOfDay < 0.95;
    if (isNight && !lastNight) tracker.unlock('night_owl');
    lastNight = isNight;
    applyTimeOfDay();
    redstone.update();
    for (const n of npcs) n.update(dt);

    // Castle visit detection
    if (player.position.x > -10 && player.position.x < 4 && player.position.z > -10 && player.position.z < 2) {
      tracker.unlock('castle_visit');
    }

    ensureChunksAround(player.position);
    rebuildDirtyChunks(2);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();

// ----- Resize -----
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// Auto-enable touch UI when first touch event happens
window.addEventListener('touchstart', () => { if (!touchActive) { touchActive = true; if (gameStarted) touch.enable(true); } }, { once: true, passive: true });

// Persist on unload
window.addEventListener('beforeunload', () => { try { world.persist(); persistInventory(); } catch (e) {} });

// Service worker registration is handled by vite-plugin-pwa virtual module.
import { registerSW } from 'virtual:pwa-register';
registerSW({ immediate: true });
