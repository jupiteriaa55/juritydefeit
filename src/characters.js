// Персонажи: мистер Юпитер (игрок) и его собака.
// Простые low-poly mascot-меши, собранные из примитивов.

import * as THREE from 'three';
import { GRID_SIZE } from './world.js';

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color, flatShading: true }));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  return m;
}
function sphere(r, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 10), new THREE.MeshLambertMaterial({ color, flatShading: true }));
  m.position.set(x, y + r, z);
  m.castShadow = true;
  return m;
}

export class Player {
  constructor(scene, x = 100, z = 100) {
    this.root = new THREE.Group();
    // тело — длинное чёрное пальто
    this.root.add(box(0.45, 0.55, 0.3, 0x1f2125, 0, 0.15, 0));
    // голова с шляпой
    this.root.add(sphere(0.18, 0xf3c895, 0, 0.78, 0)); // лицо
    this.root.add(box(0.5, 0.06, 0.5, 0x111111, 0, 1.10, 0)); // поля шляпы
    this.root.add(box(0.32, 0.22, 0.32, 0x111111, 0, 1.16, 0)); // тулья
    // борода (мультяшная)
    this.root.add(box(0.22, 0.16, 0.06, 0x9aa0a8, 0, 0.78, 0.17));
    // лопата за спиной
    const shovelHandle = box(0.06, 0.7, 0.06, 0x8a5a30, 0.22, 0.4, -0.18);
    shovelHandle.rotation.z = -0.2;
    this.root.add(shovelHandle);
    const shovelHead = box(0.18, 0.04, 0.22, 0x4a4f57, 0.34, 1.0, -0.18);
    shovelHead.rotation.z = -0.2;
    this.root.add(shovelHead);

    this.root.position.set(x, 0, z);
    scene.add(this.root);

    this.target = new THREE.Vector3(x, 0, z);
    this.position = new THREE.Vector3(x, 0, z);
    this.speed = 6; // клеток в секунду
    this.bobT = 0;
  }

  moveTo(x, z) {
    this.target.set(x, 0, z);
  }

  step(dt) {
    const dx = this.target.x - this.position.x;
    const dz = this.target.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.01) {
      const v = Math.min(dist, this.speed * dt);
      this.position.x += (dx / dist) * v;
      this.position.z += (dz / dist) * v;
      this.bobT += dt * 12;
      this.root.position.x = this.position.x;
      this.root.position.z = this.position.z;
      this.root.position.y = Math.abs(Math.sin(this.bobT)) * 0.06;
      // поворот на цель
      this.root.rotation.y = Math.atan2(dx, dz);
    } else {
      this.root.position.y *= 0.8;
    }
  }
}

export class Dog {
  constructor(scene, world, onCrystal) {
    this.world = world;
    this.onCrystal = onCrystal;
    this.root = new THREE.Group();
    // тело
    this.root.add(box(0.35, 0.22, 0.18, 0xc89060, 0, 0.18, 0));
    // голова
    this.root.add(box(0.18, 0.18, 0.18, 0xd9a070, 0.22, 0.25, 0));
    // уши
    this.root.add(box(0.05, 0.1, 0.05, 0x8a5a30, 0.22, 0.42, -0.06));
    this.root.add(box(0.05, 0.1, 0.05, 0x8a5a30, 0.22, 0.42, 0.06));
    // нос
    this.root.add(box(0.04, 0.04, 0.04, 0x202020, 0.34, 0.28, 0));
    // лапы
    for (const dx of [-0.12, 0.12]) for (const dz of [-0.06, 0.06]) {
      this.root.add(box(0.07, 0.18, 0.07, 0xa07050, dx, 0, dz));
    }
    // хвост
    this.root.add(box(0.05, 0.05, 0.18, 0xc89060, -0.22, 0.28, 0));

    this.root.position.set(100, 0, 105);
    scene.add(this.root);
    this.position = new THREE.Vector3(100, 0, 105);
    this.target = new THREE.Vector3(100, 0, 105);
    this.speed = 5;
    this.t = 0;
    this.bobT = 0;
    this.calledTo = null; // временная цель от игрока
    this._crystalCooldown = 8;
  }

  callTo(x, z) { this.calledTo = new THREE.Vector3(x, 0, z); this.target.copy(this.calledTo); }

  _pickWanderTarget(rand = Math.random) {
    const r = 6;
    const x = Math.floor(this.position.x + (rand() - 0.5) * r * 2);
    const z = Math.floor(this.position.z + (rand() - 0.5) * r * 2);
    return new THREE.Vector3(
      Math.max(2, Math.min(GRID_SIZE - 2, x)),
      0,
      Math.max(2, Math.min(GRID_SIZE - 2, z))
    );
  }

  step(dt, rand = Math.random) {
    this.t += dt;
    this._crystalCooldown -= dt;
    const dx = this.target.x - this.position.x;
    const dz = this.target.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.05) {
      const v = Math.min(dist, this.speed * dt);
      this.position.x += (dx / dist) * v;
      this.position.z += (dz / dist) * v;
      this.bobT += dt * 16;
      this.root.position.x = this.position.x;
      this.root.position.z = this.position.z;
      this.root.position.y = Math.abs(Math.sin(this.bobT)) * 0.05;
      this.root.rotation.y = Math.atan2(dx, dz);
    } else {
      // достигли цели
      if (this.calledTo) this.calledTo = null;
      // шанс «нашла кристалл»
      if (this._crystalCooldown <= 0 && rand() < 0.35) {
        const x = Math.round(this.position.x);
        const z = Math.round(this.position.z);
        this.onCrystal?.(x, z);
        this._crystalCooldown = 12 + rand() * 8;
      }
      this.target.copy(this._pickWanderTarget(rand));
    }
  }
}
