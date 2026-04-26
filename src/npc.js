// Simple NPC villagers: low-poly THREE.Group with a wandering AI.
// They have a name, a profession, and a few dialog lines.

import * as THREE from 'three';

const NAMES = ['Иван', 'Марья', 'Степан', 'Алёна', 'Лука', 'Прохор', 'Глеб', 'Зоя', 'Назар', 'Влас'];
const PROFS = ['Кузнец', 'Фермер', 'Травник', 'Каменщик', 'Стражник', 'Староста', 'Купец', 'Пекарь'];

const LINES = {
  default: [
    'Добро пожаловать в нашу деревню, путник.',
    'Слыхал, в замке есть редстоун. Можешь нажать кнопку — лампа включится!',
    'Если построишь дом получше моего — я переселюсь.',
    'По ночам бывает темно. Ставь лампы.'
  ],
  Кузнец: [
    'Молот тяжёл, но булыжник терпит.',
    'Принеси камня — отолью что-нибудь.'
  ],
  Фермер: [
    'Зерно растёт, песок мешает.',
    'Срубишь дерево — лес обиделся.'
  ],
  Стражник: [
    'Я стерегу ворота замка. Проходи.',
    'Видел тебя у леса. Будь осторожен.'
  ],
  Купец: [
    'Купи блок — продай дом!',
    'Ежедневно приходи — будут подарки.'
  ],
  Староста: [
    'Деревня молода, но крепка.',
    'Если нужен совет — нажми E.'
  ]
};

let nextId = 1;

export class NPC {
  constructor(scene, world, spawn) {
    this.id = nextId++;
    this.world = world;
    this.scene = scene;
    this.name = NAMES[Math.floor(Math.random() * NAMES.length)];
    this.profession = PROFS[Math.floor(Math.random() * PROFS.length)];
    this.dialog = (LINES[this.profession] || []).concat(LINES.default);
    this.dialogIndex = Math.floor(Math.random() * this.dialog.length);

    const skinHues = [0xf0c48d, 0xe6b07a, 0xc99166, 0xa37148];
    const shirtHues = [0x3a6db5, 0xa8493b, 0x46824a, 0x6b4a25, 0x6e6e6e];
    const pantsHues = [0x2a1f12, 0x3d3225, 0x1a3d6f];

    const skin = skinHues[Math.floor(Math.random() * skinHues.length)];
    const shirt = shirtHues[Math.floor(Math.random() * shirtHues.length)];
    const pants = pantsHues[Math.floor(Math.random() * pantsHues.length)];

    const matSkin = new THREE.MeshLambertMaterial({ color: skin });
    const matShirt = new THREE.MeshLambertMaterial({ color: shirt });
    const matPants = new THREE.MeshLambertMaterial({ color: pants });

    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), matSkin);
    head.position.y = 1.55;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), matShirt);
    body.position.y = 1.0;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.22), matShirt);
    armL.position.set(-0.36, 1.0, 0);
    const armR = armL.clone(); armR.position.x = 0.36;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.24), matPants);
    legL.position.set(-0.14, 0.33, 0);
    const legR = legL.clone(); legR.position.x = 0.14;
    g.add(head, body, armL, armR, legL, legR);
    g.castShadow = false; g.receiveShadow = false;
    g.position.set(spawn.x, spawn.y, spawn.z);
    scene.add(g);

    this.mesh = g;
    this.head = head;
    this.armL = armL; this.armR = armR;
    this.legL = legL; this.legR = legR;
    this.spawn = { ...spawn };
    this.target = this.pickTarget();
    this.cooldown = 0;
    this.walkPhase = 0;
    this.facing = 0;
    this.talking = false;
  }

  pickTarget() {
    const r = 4 + Math.random() * 5;
    const a = Math.random() * Math.PI * 2;
    return {
      x: this.spawn.x + Math.cos(a) * r,
      z: this.spawn.z + Math.sin(a) * r
    };
  }

  update(dt) {
    if (this.talking) {
      // idle bob only
      this.walkPhase += dt * 4;
      this.head.rotation.y += (Math.sin(this.walkPhase * 0.6) * 0.02);
      return;
    }
    const m = this.mesh.position;
    const dx = this.target.x - m.x;
    const dz = this.target.z - m.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.4 || this.cooldown <= 0) {
      this.target = this.pickTarget();
      this.cooldown = 3 + Math.random() * 4;
    }
    this.cooldown -= dt;
    const speed = 1.4;
    const vx = (dx / (dist || 1)) * speed;
    const vz = (dz / (dist || 1)) * speed;

    // step on ground: keep on top of column
    const nx = m.x + vx * dt;
    const nz = m.z + vz * dt;
    const groundY = this.world.heightAt(Math.floor(nx), Math.floor(nz)) + 1;
    m.x = nx; m.z = nz;
    m.y = groundY;
    this.facing = Math.atan2(dx, dz);
    this.mesh.rotation.y = this.facing;
    this.walkPhase += dt * 6;
    const swing = Math.sin(this.walkPhase) * 0.5;
    this.armL.rotation.x = swing;
    this.armR.rotation.x = -swing;
    this.legL.rotation.x = -swing;
    this.legR.rotation.x = swing;
  }

  nextLine() {
    const line = this.dialog[this.dialogIndex % this.dialog.length];
    this.dialogIndex++;
    return line;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse(obj => { if (obj.geometry) obj.geometry.dispose(); if (obj.material) obj.material.dispose(); });
  }
}
