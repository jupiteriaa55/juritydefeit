// Перспективная 3D-камера с видом сверху под наклоном (≈55°).
// Объекты вдалеке уменьшаются — настоящий 3D-эффект, не плоская ортография.
// Управление: drag (ПКМ/ЛКМ), колесо/щипок, кнопки + и −, WASD/стрелки.

import * as THREE from 'three';
import { GRID_SIZE } from './world.js';

const TILT = THREE.MathUtils.degToRad(58); // угол наклона камеры от горизонтали
const FOV = 35; // узкий FOV → меньше искажений, больше «3D-карта Godot»

export class CameraControl {
  constructor(canvas) {
    this.canvas = canvas;
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 600);

    // Целевая точка, на которую смотрит камера (центр кладбища).
    this.target = new THREE.Vector3(GRID_SIZE / 2, 0, GRID_SIZE / 2);
    // Дистанция от target до камеры — играет роль зума.
    this.dist = 38;
    this.minDist = 12;
    this.maxDist = 140;

    // Состояние пана/жестов.
    this._dragStart = null;
    this._dragTarget = null;
    this._pinchPrev = null;
    this._keys = new Set();

    this._bind();
    this._onResize();
    this.update();
  }

  _bind() {
    window.addEventListener('resize', () => { this._onResize(); this.update(); });

    this.canvas.addEventListener('pointerdown', (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      this._dragStart = { x: e.clientX, y: e.clientY };
      this._dragTarget = this.target.clone();
      this._didDrag = false;
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this._dragStart) return;
      const dx = e.clientX - this._dragStart.x;
      const dy = e.clientY - this._dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 6) this._didDrag = true;
      // Перевод экранных пикселей в мировые координаты при перспективе:
      // на уровне target высота кадра = 2 * dist * tan(FOV/2).
      const h = this.canvas.clientHeight || window.innerHeight;
      const w = this.canvas.clientWidth || window.innerWidth;
      const worldH = 2 * this.dist * Math.tan(THREE.MathUtils.degToRad(FOV) / 2);
      const worldW = worldH * (w / h);
      const wx = (dx / w) * worldW;
      // По экранной оси Y движение «вглубь» — компенсируем наклон камеры.
      const wz = (dy / h) * worldH / Math.cos(Math.PI / 2 - TILT);
      this.target.x = this._dragTarget.x - wx;
      this.target.z = this._dragTarget.z - wz;
      this._clampTarget();
      this.update();
    });
    const endDrag = (e) => {
      const dragged = !!this._didDrag;
      this._dragStart = null;
      this._dragTarget = null;
      this._didDrag = false;
      if (!dragged && this.onClick) this.onClick(e);
    };
    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);
    this.canvas.addEventListener('pointerleave', () => { this._dragStart = null; });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = Math.exp(e.deltaY * 0.001);
      this.setDist(this.dist * factor);
    }, { passive: false });

    // Жесты — пинч.
    this._touches = new Map();
    this.canvas.addEventListener('pointerdown', (e) => { this._touches.set(e.pointerId, e); });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this._touches.has(e.pointerId)) return;
      this._touches.set(e.pointerId, e);
      if (this._touches.size === 2) {
        const [a, b] = [...this._touches.values()];
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (this._pinchPrev != null) {
          const ratio = this._pinchPrev / dist;
          this.setDist(this.dist * ratio);
        }
        this._pinchPrev = dist;
        this._dragStart = null;
      }
    });
    const removeTouch = (e) => { this._touches.delete(e.pointerId); if (this._touches.size < 2) this._pinchPrev = null; };
    this.canvas.addEventListener('pointerup', removeTouch);
    this.canvas.addEventListener('pointercancel', removeTouch);

    window.addEventListener('keydown', (e) => {
      this._keys.add(e.key.toLowerCase());
      if (e.key === '+' || e.key === '=') this.setDist(this.dist * 0.85);
      if (e.key === '-' || e.key === '_') this.setDist(this.dist * 1.15);
    });
    window.addEventListener('keyup', (e) => { this._keys.delete(e.key.toLowerCase()); });
  }

  setDist(v) {
    this.dist = Math.max(this.minDist, Math.min(this.maxDist, v));
    this.update();
  }
  zoomIn() { this.setDist(this.dist * 0.82); }
  zoomOut() { this.setDist(this.dist * 1.22); }
  // Совместимость со старым API.
  get zoom() { return this.dist; }
  set zoom(v) { this.setDist(v); }

  _clampTarget() {
    const m = 4;
    this.target.x = Math.max(-m, Math.min(GRID_SIZE + m, this.target.x));
    this.target.z = Math.max(-m, Math.min(GRID_SIZE + m, this.target.z));
  }

  _onResize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  update() {
    // Позиция камеры: вверх и назад от target по углу TILT (от горизонтали).
    // dist — это расстояние от камеры до target по прямой.
    const cy = Math.sin(TILT) * this.dist;
    const cz = Math.cos(TILT) * this.dist;
    this.camera.position.set(this.target.x, cy, this.target.z + cz);
    this.camera.lookAt(this.target);
  }

  step(dt) {
    let dx = 0, dz = 0;
    if (this._keys.has('arrowleft') || this._keys.has('a')) dx -= 1;
    if (this._keys.has('arrowright') || this._keys.has('d')) dx += 1;
    if (this._keys.has('arrowup') || this._keys.has('w')) dz -= 1;
    if (this._keys.has('arrowdown') || this._keys.has('s')) dz += 1;
    if (dx || dz) {
      const speed = this.dist * 0.8;
      const len = Math.hypot(dx, dz) || 1;
      this.target.x += (dx / len) * speed * dt;
      this.target.z += (dz / len) * speed * dt;
      this._clampTarget();
      this.update();
    }
  }

  // Вернуть мировую (x,z) клетку по экранному пикселю.
  // Raycaster одинаково работает с ортогональной и перспективной камерой.
  pickCell(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1)
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, hit);
    if (!hit) return null;
    const x = Math.round(hit.x);
    const z = Math.round(hit.z);
    return { x, z };
  }
}
