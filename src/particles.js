// Lightweight cube-particle system. Spawns small textured cubes that fly with
// gravity for a short lifetime when a block is broken. Uses a single
// InstancedMesh per spawn batch to keep draw calls low.

import * as THREE from 'three';
import { atlasTexture } from './textures.js';
import { uvFor } from './textures.js';

const MAX = 32;

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.batches = []; // {mesh, parts: [{vel, life}], total}
  }

  spawnBreak(blockId, x, y, z) {
    const count = 14;
    const geo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    // remap UVs to a tile of the block on the atlas
    const [u0, v0, u1, v1] = uvFor(blockId, 'side');
    const uvs = geo.attributes.uv;
    for (let i = 0; i < uvs.count; i++) {
      const u = uvs.getX(i), v = uvs.getY(i);
      uvs.setXY(i, u0 + u * (u1 - u0), v0 + v * (v1 - v0));
    }
    uvs.needsUpdate = true;
    const mat = new THREE.MeshLambertMaterial({ map: atlasTexture, transparent: true, alphaTest: 0.05 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const m = new THREE.Matrix4();
    const parts = [];
    for (let i = 0; i < count; i++) {
      const px = x + 0.5 + (Math.random() - 0.5) * 0.6;
      const py = y + 0.5 + (Math.random() - 0.5) * 0.6;
      const pz = z + 0.5 + (Math.random() - 0.5) * 0.6;
      m.makeTranslation(px, py, pz);
      mesh.setMatrixAt(i, m);
      parts.push({
        x: px, y: py, z: pz,
        vx: (Math.random() - 0.5) * 4,
        vy: 2 + Math.random() * 4,
        vz: (Math.random() - 0.5) * 4,
        rx: Math.random() * Math.PI * 2,
        ry: Math.random() * Math.PI * 2,
        rvx: (Math.random() - 0.5) * 8,
        rvy: (Math.random() - 0.5) * 8,
        life: 0.7 + Math.random() * 0.4
      });
    }
    this.scene.add(mesh);
    this.batches.push({ mesh, parts });
  }

  update(dt) {
    const m = new THREE.Matrix4();
    const e = new THREE.Euler();
    const q = new THREE.Quaternion();
    const t = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    for (let i = this.batches.length - 1; i >= 0; i--) {
      const batch = this.batches[i];
      let alive = false;
      for (let j = 0; j < batch.parts.length; j++) {
        const p = batch.parts[j];
        if (p.life <= 0) continue;
        alive = true;
        p.life -= dt;
        p.vy -= 16 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.rx += p.rvx * dt; p.ry += p.rvy * dt;
        e.set(p.rx, p.ry, 0);
        q.setFromEuler(e);
        t.set(p.x, p.y, p.z);
        m.compose(t, q, s);
        batch.mesh.setMatrixAt(j, m);
      }
      batch.mesh.instanceMatrix.needsUpdate = true;
      if (!alive) {
        this.scene.remove(batch.mesh);
        batch.mesh.geometry.dispose();
        batch.mesh.material.dispose();
        this.batches.splice(i, 1);
      }
    }
  }
}
