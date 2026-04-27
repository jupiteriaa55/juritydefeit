// Точка входа: инициализация Three.js, мира, камеры, ввода, UI и игрового цикла.

import * as THREE from 'three';
import { World, GRID_SIZE } from './world.js';
import { CameraControl } from './cameraControl.js';
import { Player, Dog } from './characters.js';
import { ITEM_DEFS, TOOL, CELL, defByCellId, neighborBonus } from './items.js';
import { generateOrder, evaluateOrder } from './orders.js';
import { UI } from './ui.js';

const canvas = document.getElementById('game');

// ---------- Renderer + scene ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x9fcde6); // мультяшное светло-голубое небо

function resizeRenderer() {
  const w = canvas.clientWidth || window.innerWidth;
  const h = canvas.clientHeight || window.innerHeight;
  renderer.setSize(w, h, false);
}
window.addEventListener('resize', resizeRenderer);
resizeRenderer();

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xa8d6e8, 80, 220);

// освещение «мультяшное»
const hemi = new THREE.HemisphereLight(0xffffff, 0x6c8a55, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2c8, 1.15);
sun.position.set(120, 160, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 400;
scene.add(sun);
scene.add(sun.target);

// ---------- World, camera, characters ----------
const world = new World(scene);
const cam = new CameraControl(canvas);
cam.target.set(GRID_SIZE / 2, 0, GRID_SIZE / 2);
cam.update();

const player = new Player(scene, GRID_SIZE / 2, GRID_SIZE / 2);
const dog = new Dog(scene, world, (x, z) => {
  // Собака нашла кристалл — кладём на свободную клетку, добавляем заметку.
  if (world.get(x, z) === CELL.GRASS) {
    world.set(x, z, ITEM_DEFS.crystal.cellId);
    state.foundCrystals.push({ x, z });
    ui.toast(`🐕 Собака нашла кристалл! +${ITEM_DEFS.crystal.style} стиля близлежащим могилам.`, 'good');
  }
});

// ---------- Game state ----------
const state = {
  day: 1,
  money: 500,
  rep: 0,
  activeOrder: null,
  tool: null,
  foundCrystals: [],
};

// Простой ГПСЧ (Mulberry32) для повторяемости в одном раунде.
function mulberry32(seed) { return function () { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = mulberry32(Date.now() & 0xffffffff);

// ---------- UI ----------
const ui = new UI({
  onTool: (id) => { state.tool = id || null; },
  onEndDay: () => endDay(),
  onNewOrder: () => takeNewOrder(),
  onFinishOrder: () => finishOrder(),
  onZoomIn: () => cam.zoomIn(),
  onZoomOut: () => cam.zoomOut(),
});

function refreshUI() {
  ui.setStats({ day: state.day, money: state.money, rep: state.rep });
  ui.setOrder(state.activeOrder, currentStyleForOrder());
}

// Стиль текущего заказа считается по клетке могилы заказа.
function currentStyleForOrder() {
  const o = state.activeOrder;
  if (!o || o.cellX == null) return 0;
  const v = world.get(o.cellX, o.cellZ);
  const def = defByCellId(v);
  const base = def?.style ?? 0;
  const nb = neighborBonus((x, z) => world.get(x, z), o.cellX, o.cellZ);
  // бонус соседних кристаллов — учитывается отдельно для зрелищности.
  let crystalBonus = 0;
  for (const c of state.foundCrystals) {
    const dx = c.x - o.cellX, dz = c.z - o.cellZ;
    if (Math.hypot(dx, dz) <= 5) crystalBonus += 1;
  }
  return base + nb + crystalBonus;
}

// ---------- Game actions ----------
function takeNewOrder() {
  if (state.activeOrder && !state.activeOrder.finished) {
    ui.toast('Сначала сдайте текущий заказ.', 'bad');
    return;
  }
  state.activeOrder = generateOrder(rand, state.day);
  ui.toast(`Новый заказ: ${state.activeOrder.name} (${state.activeOrder.levelName}). ${state.activeOrder.deadline} дн., бюджет ${state.activeOrder.expBudget}⛀.`, 'good');
  refreshUI();
}

function endDay() {
  state.day += 1;
  if (state.activeOrder && !state.activeOrder.finished) {
    state.activeOrder.daysLeft -= 1;
    if (state.activeOrder.daysLeft < 0) {
      ui.toast('⚠ Срок заказа истёк! Скидка к выплате.', 'bad');
    }
  }
  // Каждый день — небольшой пассивный приход репутации, если что-то стоит.
  refreshUI();
}

function finishOrder() {
  const o = state.activeOrder;
  if (!o) { ui.toast('Нет заказа для сдачи.', 'bad'); return; }
  if (o.cellX == null) { ui.toast('Сначала выкопайте могилу и поставьте надгробие.', 'bad'); return; }
  const cellVal = world.get(o.cellX, o.cellZ);
  const def = defByCellId(cellVal);
  if (!def || def.cat !== 'tomb') { ui.toast('На могиле должно быть надгробие.', 'bad'); return; }
  if (!o.nameWritten) { ui.toast('Не написано имя на надгробии.', 'bad'); return; }
  // Стиль = базовый стиль надгробия + бонус соседей (цветы/дорожки) + кристаллы.
  const baseStyle = def.style ?? 0;
  const nb = neighborBonus((x, z) => world.get(x, z), o.cellX, o.cellZ);
  let crystalBonus = 0;
  for (const c of state.foundCrystals) {
    const dx = c.x - o.cellX, dz = c.z - o.cellZ;
    if (Math.hypot(dx, dz) <= 5) crystalBonus += 1;
  }
  const result = evaluateOrder(o, baseStyle, nb + crystalBonus);
  if (!result.ok) {
    ui.toast(result.message, 'bad');
    return;
  }
  state.money += result.payment;
  state.rep += Math.max(0, Math.round(result.profit / 30));
  o.finished = true;
  ui.toast(`${result.message} Получено ${result.payment}⛀.`, result.profit >= 0 ? 'good' : 'bad');
  state.activeOrder = null;
  refreshUI();
}

// Применить инструмент к клетке (x,z).
function applyToolAt(x, z) {
  const tool = state.tool;
  if (!tool) {
    ui.toast('Выберите инструмент справа.', '');
    return;
  }
  if (!world.inBounds(x, z)) return;
  player.moveTo(x, z);

  const def = ITEM_DEFS[tool];
  if (!def) return;

  // Действия (DIG/FILL/NAME/REMOVE/CALL_DOG)
  if (def.cat === 'action') {
    if (def.tool === TOOL.DIG) {
      const cur = world.get(x, z);
      if (cur !== CELL.GRASS) { ui.toast('Здесь уже что-то есть.', 'bad'); return; }
      world.set(x, z, CELL.PIT);
      // Если есть активный заказ и могила ещё не назначена — закрепляем.
      if (state.activeOrder && state.activeOrder.cellX == null) {
        state.activeOrder.cellX = x; state.activeOrder.cellZ = z;
        ui.toast('Могила выкопана. Теперь засыпьте и поставьте надгробие.', 'good');
      } else {
        ui.toast('Могила выкопана.', '');
      }
    } else if (def.tool === TOOL.FILL) {
      const cur = world.get(x, z);
      if (cur !== CELL.PIT) { ui.toast('Засыпать можно только выкопанную яму.', 'bad'); return; }
      world.set(x, z, CELL.FILLED);
      ui.toast('Могила засыпана.', '');
    } else if (def.tool === TOOL.NAME) {
      const cur = world.get(x, z);
      const tdef = defByCellId(cur);
      if (!tdef || tdef.cat !== 'tomb') { ui.toast('Имя пишется на надгробии.', 'bad'); return; }
      const o = state.activeOrder;
      ui.modal({
        title: 'Написать имя',
        body: `Какое имя выгравировать на надгробии?${o ? ` (по заказу: ${o.name})` : ''}`,
        input: true,
        inputPlaceholder: o?.name || 'Иванов И.И.',
        okText: 'Выгравировать',
        onOk: (text) => {
          const value = text || o?.name || 'Без имени';
          world.setMeta(x, z, { name: value });
          if (o && o.cellX === x && o.cellZ === z && value.toLowerCase().includes(o.name.split(' ')[0].toLowerCase())) {
            o.nameWritten = true;
            ui.toast(`Имя выгравировано: «${value}». Заказ почти готов.`, 'good');
          } else {
            ui.toast(`Имя выгравировано: «${value}».`, '');
          }
          refreshUI();
        },
      });
      return;
    } else if (def.tool === TOOL.REMOVE) {
      const cur = world.get(x, z);
      if (cur === CELL.GRASS) { ui.toast('Здесь нечего сносить.', 'bad'); return; }
      const tdef = defByCellId(cur);
      const refund = tdef ? Math.round((tdef.cost || 0) * 0.5) : 0;
      world.set(x, z, CELL.GRASS);
      state.money += refund;
      if (refund) ui.toast(`Снесено. Возврат ${refund}⛀.`, '');
      else ui.toast('Снесено.', '');
    } else if (def.tool === TOOL.CALL_DOG) {
      dog.callTo(x, z);
      ui.toast('🐕 Собака бежит сюда искать кристалл!', '');
    }
    refreshUI();
    return;
  }

  // Размещаемый объект
  const cur = world.get(x, z);

  // Надгробия требуют засыпанную могилу (если пусто — копаем+засыпаем автоматически за 0).
  if (def.cat === 'tomb') {
    if (cur !== CELL.FILLED && cur !== CELL.PIT && cur !== CELL.GRASS) {
      ui.toast('Снесите старый объект, прежде чем ставить надгробие.', 'bad');
      return;
    }
    if (state.money < def.cost) { ui.toast('Не хватает денег.', 'bad'); return; }
    state.money -= def.cost;
    if (state.activeOrder && state.activeOrder.cellX == null) {
      state.activeOrder.cellX = x; state.activeOrder.cellZ = z;
    }
    if (state.activeOrder && state.activeOrder.cellX === x && state.activeOrder.cellZ === z) {
      state.activeOrder.spent += def.cost;
    }
    world.set(x, z, def.cellId);
    ui.toast(`Поставлено: ${def.name}.`, 'good');
    refreshUI();
    return;
  }

  // Цветы/дорожки/декор — ставятся только на траве (или поверх такой же категории — заменяя).
  if (cur !== CELL.GRASS) {
    const cdef = defByCellId(cur);
    if (!cdef || cdef.cat === 'tomb' || cur === CELL.PIT || cur === CELL.FILLED) {
      ui.toast('Сначала освободите клетку (Снести).', 'bad');
      return;
    }
  }
  if (state.money < def.cost) { ui.toast('Не хватает денег.', 'bad'); return; }
  state.money -= def.cost;
  if (state.activeOrder) state.activeOrder.spent += Math.round(def.cost * 0.4); // косвенные расходы заказа
  world.set(x, z, def.cellId);
  ui.toast(`Поставлено: ${def.name}.`, '');
  refreshUI();
}

// ---------- Input ----------
cam.onClick = (e) => {
  const c = cam.pickCell(e.clientX, e.clientY);
  if (c) applyToolAt(c.x, c.z);
};

canvas.addEventListener('pointermove', (e) => {
  const c = cam.pickCell(e.clientX, e.clientY);
  if (c) world.setHighlight(c.x, c.z, true);
});

// ---------- Loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  cam.step(dt);
  player.step(dt);
  dog.step(dt, rand);
  // солнце "идёт" за камерой (тени везде красивые)
  sun.position.set(cam.target.x + 60, 160, cam.target.z + 30);
  sun.target.position.copy(cam.target);
  sun.target.updateMatrixWorld();
  renderer.render(scene, cam.camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Стартовое состояние UI и первый заказ.
refreshUI();
takeNewOrder();
ui.toast('Добро пожаловать на кладбище! Возьмите заказ и обустройте могилу.', 'good');

// Экспортируем для отладки.
window.__game = { state, world, scene, cam, player, dog };
