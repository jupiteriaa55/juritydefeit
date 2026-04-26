// First-person player with AABB voxel collision, gravity, jump, swim, and a
// view raycast to pick blocks.

import * as THREE from 'three';
import { isSolid, isOpaque, isTransparent } from './blocks.js';
import * as B from './blocks.js';
import { WORLD_H } from './world.js';

const G = 28;
const PLAYER_H = 1.75;
const PLAYER_R = 0.3;
const EYE = 1.62;
const STEP = 0.05; // sub-step for collision

export class Player {
  constructor(camera, world) {
    this.world = world;
    this.camera = camera;
    this.position = new THREE.Vector3(0, WORLD_H, 0);
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.flying = false;
    this.speed = 4.5;
    this.runMul = 1.7;
    this.input = { forward: 0, right: 0, jump: false, sprint: false, ascend: false };
    this.mode = 'creative'; // 'creative' | 'survival'
  }

  setMode(m) {
    this.mode = m;
    this.flying = (m === 'creative');
  }

  applyOrientation() {
    const e = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(e);
    this.camera.position.copy(this.position).y += EYE;
  }

  update(dt) {
    // Movement direction
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const wish = new THREE.Vector3();
    wish.addScaledVector(forward, this.input.forward);
    wish.addScaledVector(right, this.input.right);
    if (wish.lengthSq() > 0) wish.normalize();
    let speed = this.speed * (this.input.sprint ? this.runMul : 1);
    if (this.flying) speed *= 1.5;

    if (this.flying) {
      this.velocity.x = wish.x * speed;
      this.velocity.z = wish.z * speed;
      let vy = 0;
      if (this.input.jump) vy += speed;
      if (this.input.descend) vy -= speed;
      this.velocity.y = vy;
    } else {
      // ground accel
      const target = wish.multiplyScalar(speed);
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, target.x, this.onGround ? 0.5 : 0.12);
      this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, target.z, this.onGround ? 0.5 : 0.12);
      // gravity
      this.velocity.y -= G * dt;
      const inWater = this.isInWater();
      if (inWater) {
        this.velocity.y *= 0.6; // buoyancy/dampen
        if (this.input.jump) this.velocity.y = 4;
      } else if (this.input.jump && this.onGround) {
        this.velocity.y = 9.0;
      }
    }

    // Move with sub-stepping for stability
    const dx = this.velocity.x * dt;
    const dy = this.velocity.y * dt;
    const dz = this.velocity.z * dt;
    this.moveAxis(0, dx);
    this.moveAxis(1, dy);
    this.moveAxis(2, dz);

    this.applyOrientation();
  }

  moveAxis(axis, delta) {
    if (delta === 0) return;
    const sign = Math.sign(delta);
    let remaining = Math.abs(delta);
    while (remaining > 0) {
      const step = Math.min(STEP, remaining);
      const next = this.position.clone();
      if (axis === 0) next.x += sign * step;
      else if (axis === 1) next.y += sign * step;
      else next.z += sign * step;

      if (this.collides(next)) {
        if (axis === 1) {
          if (sign < 0) this.onGround = true;
          this.velocity.y = 0;
        } else {
          if (axis === 0) this.velocity.x = 0;
          else this.velocity.z = 0;
        }
        return;
      }
      this.position.copy(next);
      if (axis === 1 && sign < 0) this.onGround = false;
      remaining -= step;
    }
    if (axis === 1 && delta > 0) this.onGround = false;
  }

  collides(p) {
    const minX = Math.floor(p.x - PLAYER_R);
    const maxX = Math.floor(p.x + PLAYER_R);
    const minY = Math.floor(p.y);
    const maxY = Math.floor(p.y + PLAYER_H);
    const minZ = Math.floor(p.z - PLAYER_R);
    const maxZ = Math.floor(p.z + PLAYER_R);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (isSolid(this.world.getBlock(x, y, z))) return true;
        }
      }
    }
    return false;
  }

  isInWater() {
    const x = Math.floor(this.position.x);
    const z = Math.floor(this.position.z);
    const y = Math.floor(this.position.y + 0.6);
    return this.world.getBlock(x, y, z) === B.WATER;
  }

  // Voxel raycast. Returns { hit:{x,y,z}, prev:{x,y,z}, blockId } or null.
  raycast(maxDist = 6) {
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = Math.sign(dir.x) || 0;
    const stepY = Math.sign(dir.y) || 0;
    const stepZ = Math.sign(dir.z) || 0;
    const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;
    let tMaxX = stepX > 0 ? (Math.ceil(origin.x) - origin.x) / dir.x : (origin.x - Math.floor(origin.x)) / -dir.x;
    let tMaxY = stepY > 0 ? (Math.ceil(origin.y) - origin.y) / dir.y : (origin.y - Math.floor(origin.y)) / -dir.y;
    let tMaxZ = stepZ > 0 ? (Math.ceil(origin.z) - origin.z) / dir.z : (origin.z - Math.floor(origin.z)) / -dir.z;
    if (!isFinite(tMaxX)) tMaxX = Infinity;
    if (!isFinite(tMaxY)) tMaxY = Infinity;
    if (!isFinite(tMaxZ)) tMaxZ = Infinity;

    let prev = { x, y, z };
    let dist = 0;
    while (dist < maxDist) {
      const id = this.world.getBlock(x, y, z);
      if (id !== B.AIR && id !== B.WATER) {
        return { hit: { x, y, z }, prev, blockId: id };
      }
      prev = { x, y, z };
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; dist = tMaxX; tMaxX += tDeltaX;
      } else if (tMaxY < tMaxZ) {
        y += stepY; dist = tMaxY; tMaxY += tDeltaY;
      } else {
        z += stepZ; dist = tMaxZ; tMaxZ += tDeltaZ;
      }
    }
    return null;
  }
}
