// Изометрическая ортокамера в стиле «Весёлый Могильщик» 2010 (Flash/Alawar):
// фиксированный угол обзора (~30° наклон, 45° поворот) — настоящая isometric-проекция,
// без перспективных искажений, объекты вдалеке такого же размера, как и рядом.
// Управление: drag (ПКМ/ЛКМ), колесо/щипок, кнопки + и −, WASD/стрелки.

import * as THREE from 'three';
import { GRID_SIZE } from './world.js';

const TILT = THREE.MathUtils.degToRad(35);  // наклон от горизонтали (≈ изометрия)
const YAW  = THREE.MathUtils.degToRad(45);  // поворот вокруг вертикальной оси

export class CameraControl {
  constructor(canvas) {
    this.canvas = canvas;
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 1000);

    this.target = new THREE.Vector3(GRID_SIZE / 2, 0, GRID_SIZE / 2);
    this.zoom = 16;       // полувысота кадра в клетках
    this.minZoom = 6;
    this.maxZoom = 70;

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
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      const worldH = this.zoom * 2;
      const worldW = worldH * (w / h);
      // Учитываем поворот (yaw): экранные оси не совпадают с мировыми.
      const wx = (dx / w) * worldW;
      const wy = (dy / h) * worldH / Math.cos(Math.PI / 2 - TILT);
      // Преобразуем экранный (wx, wy) в мировой (X, Z) поворотом обратно на YAW.
      const cosY = Math.cos(YAW), sinY = Math.sin(YAW);
      const moveX = -wx * cosY - wy * sinY;
      const moveZ =  wx * sinY - wy * cosY;
      this.target.x = this._dragTarget.x + moveX;
      this.target.z = this._dragTarget.z + moveZ;
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
      this.setZoom(this.zoom * factor);
    }, { passive: false });

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
          this.setZoom(this.zoom * ratio);
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
      if (e.key === '+' || e.key === '=') this.setZoom(this.zoom * 0.85);
      if (e.key === '-' || e.key === '_') this.setZoom(this.zoom * 1.15);
    });
    window.addEventListener('keyup', (e) => { this._keys.delete(e.key.toLowerCase()); });
  }

  setZoom(v) {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, v));
    this._onResize();
    this.update();
  }
  zoomIn() { this.setZoom(this.zoom * 0.85); }
  zoomOut() { this.setZoom(this.zoom * 1.18); }
  // Совместимость со старым API (cameraControl.dist).
  get dist() { return this.zoom; }
  set dist(v) { this.setZoom(v); }
  setDist(v) { this.setZoom(v); }

  _clampTarget() {
    const m = 6;
    this.target.x = Math.max(-m, Math.min(GRID_SIZE + m, this.target.x));
    this.target.z = Math.max(-m, Math.min(GRID_SIZE + m, this.target.z));
  }

  _onResize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const aspect = w / h;
    const halfH = this.zoom;
    const halfW = halfH * aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();
  }

  update() {
    // Позиция камеры с учётом наклона TILT и поворота YAW вокруг target.
    const dist = this.zoom * 2.4;
    const horiz = Math.cos(TILT) * dist;
    const cy = Math.sin(TILT) * dist;
    const cx = Math.sin(YAW) * horiz;
    const cz = Math.cos(YAW) * horiz;
    this.camera.position.set(this.target.x + cx, cy, this.target.z + cz);
    this.camera.lookAt(this.target);
  }

  step(dt) {
    let dx = 0, dz = 0;
    if (this._keys.has('arrowleft') || this._keys.has('a')) dx -= 1;
    if (this._keys.has('arrowright') || this._keys.has('d')) dx += 1;
    if (this._keys.has('arrowup') || this._keys.has('w')) dz -= 1;
    if (this._keys.has('arrowdown') || this._keys.has('s')) dz += 1;
    if (dx || dz) {
      // Идём по экранным осям, поэтому учитываем YAW.
      const speed = this.zoom * 1.6;
      const len = Math.hypot(dx, dz) || 1;
      const sx = (dx / len) * speed * dt;
      const sy = (dz / len) * speed * dt;
      const cosY = Math.cos(YAW), sinY = Math.sin(YAW);
      this.target.x += -sx * cosY - sy * sinY;
      this.target.z +=  sx * sinY - sy * cosY;
      this._clampTarget();
      this.update();
    }
  }

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
